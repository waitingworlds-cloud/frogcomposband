/* File: main-shell.c */

/*
 * "Shell" front end: the game draws nothing itself. It connects to a local
 * TCP port (FROG_SHELL_PORT), sends the text grid and a JSON description of
 * the game state, and reads key presses back. The interface lives in shell/.
 *
 * Protocol, one JSON object per line, game to shell:
 *   {"t":"hello", ...}      once, with the colour table
 *   {"t":"dict", ...}       once the data files are loaded (names by id)
 *   {"t":"f", ...}          text grid rows that changed
 *   {"t":"s", ...}          game state, sent whenever the game waits for a key
 * Shell to game, one command per line:
 *   X <hex bytes>           key codes to feed to the game
 *   R <cols> <rows>         resize the text grid
 */

#include "angband.h"

#ifdef USE_SHELL

#include "equip.h"
#include "inv.h"
#include "pack.h"
#include "message.h"

#ifdef WINDOWS
# include <winsock2.h>
# include <ws2tcpip.h>
typedef SOCKET sock_t;
# define sock_close closesocket
#else
# include <sys/types.h>
# include <sys/socket.h>
# include <sys/select.h>
# include <netinet/in.h>
# include <netinet/tcp.h>
# include <arpa/inet.h>
# include <unistd.h>
typedef int sock_t;
# define sock_close close
# define INVALID_SOCKET (-1)
#endif

#define SHELL_MAX_W 255
#define SHELL_MAX_H 127

extern rect_t ui_effects_rect(void);
extern int ui_screen_depth(void);

static term shell_term;
static sock_t shell_sock = INVALID_SOCKET;

static byte old_a[SHELL_MAX_H][SHELL_MAX_W];
static char old_c[SHELL_MAX_H][SHELL_MAX_W];
static bool old_valid = FALSE;
static bool want_state = FALSE;
static bool ui_live = FALSE;
static int click_kind = 0, click_x = 0, click_y = 0;
bool shell_take_click(int *kind, int *x, int *y)
{
    if (!click_kind) return FALSE;
    *kind = click_kind; *x = click_x; *y = click_y;
    click_kind = 0;
    return TRUE;
}
static int view_w = 61, view_h = 41;   /* squares of map sent around the player */
static bool dict_sent = FALSE;
static u32b dict_seed = 0;   /* flavours are shuffled per game: send the list again when they change */
static int  want_w = 0, want_h = 0;

/* ---------------------------------------------------------------- output */
static char *obuf = NULL;
static int   olen = 0, ocap = 0;

static void o_need(int n)
{
    if (olen + n + 1 > ocap)
    {
        ocap = (olen + n + 1) * 2 + 4096;
        obuf = realloc(obuf, ocap);
        if (!obuf) quit("shell: out of memory");
    }
}
static void o_raw(cptr s)
{
    int n = strlen(s);
    o_need(n);
    memcpy(obuf + olen, s, n);
    olen += n;
}
static void o_fmt(cptr fmt, ...)
{
    char tmp[512];
    va_list vp;
    va_start(vp, fmt);
    vsnprintf(tmp, sizeof(tmp), fmt, vp);
    va_end(vp);
    o_raw(tmp);
}
static void o_chr(unsigned char c)
{
    o_need(8);
    if (c == '"' || c == '\\') { obuf[olen++] = '\\'; obuf[olen++] = c; }
    else if (c < 0x20 || c >= 0x7f) olen += sprintf(obuf + olen, "\\u%04x", c);
    else obuf[olen++] = c;
}
static void o_strn(cptr s, int n)
{
    int i;
    o_need(2);
    obuf[olen++] = '"';
    for (i = 0; i < n && s[i]; i++) o_chr((unsigned char)s[i]);
    o_need(2);
    obuf[olen++] = '"';
}
static void o_str(cptr s) { o_strn(s ? s : "", s ? (int)strlen(s) : 0); }
static void o_key(cptr k) { o_fmt("\"%s\":", k); }
static void o_kstr(cptr k, cptr s) { o_key(k); o_str(s); o_raw(","); }
static void o_kint(cptr k, long v) { o_fmt("\"%s\":%ld,", k, v); }
/* close an object or array, dropping a trailing comma */
static void o_close(char c)
{
    if (olen && obuf[olen - 1] == ',') olen--;
    o_need(2);
    obuf[olen++] = c;
}
/* the interface has gone: keep the character safe, then leave */
static void shell_lost(void)
{
    static bool once = FALSE;
    shell_sock = INVALID_SOCKET;
    if (once) return;
    once = TRUE;
    if (character_generated && !p_ptr->is_dead && !character_saved) exit_game_panic();
    quit(NULL);
}
static void o_send(void)
{
    int done = 0;
    if (shell_sock == INVALID_SOCKET) { olen = 0; return; }
    o_need(1);
    obuf[olen++] = '\n';
    while (done < olen)
    {
        int n = send(shell_sock, obuf + done, olen - done, 0);
        if (n <= 0) shell_lost();
        done += n;
    }
    olen = 0;
}

/* ----------------------------------------------------------------- input */
static char ibuf[4096];
static int  ilen = 0;

static int hexv(char c)
{
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

static void shell_command(char *line)
{
    if (line[0] == 'X' && line[1] == ' ')
    {
        char *p = line + 2;
        while (hexv(p[0]) >= 0 && hexv(p[1]) >= 0)
        {
            int k = hexv(p[0]) * 16 + hexv(p[1]);
            if (k) Term_keypress(k);
            p += 2;
        }
    }
    else if (line[0] == 'Q')
    {
        /* the window is closing: save and leave, as the game's own Exit menu does */
        if (character_generated && !p_ptr->is_dead)
        {
            if (can_save)
            {
                forget_lite();
                forget_view();
                clear_mon_lite();
                Term_key_push(SPECIAL_KEY_QUIT);
            }
            else exit_game_panic();
        }
        else quit(NULL);
    }
    else if (line[0] == 'M' && line[1] == ' ')
    {
        /* a mouse click on the map, as squares away from the player. Only taken while the
         * game waits for a command, so it can never answer some other question by mistake */
        int kind = 0, dx = 0, dy = 0;
        if (sscanf(line + 2, "%d %d %d", &kind, &dx, &dy) != 3) return;
        if (kind == 3)
        {
            /* from the level map screen: close it, then walk */
            if (!character_generated || p_ptr->wild_mode || !in_bounds(py + dy, px + dx)) return;
            click_kind = 1; click_x = px + dx; click_y = py + dy;
            Term_keypress(ESCAPE); Term_keypress('\\'); Term_keypress('`');
            return;
        }
        if (!inkey_flag || character_icky || ui_screen_depth() || !character_generated || p_ptr->wild_mode) return;
        if (kind == 1 && !dx && !dy) { Term_keypress('\\'); Term_keypress('g'); }
        else if (kind == 1 && ABS(dx) <= 1 && ABS(dy) <= 1)
        {
            Term_keypress('\\'); Term_keypress(';');
            Term_keypress('0' + (dy < 0 ? 7 : dy > 0 ? 1 : 4) + dx + 1);
        }
        else if (kind == 1 || kind == 2)
        {
            click_kind = kind; click_x = px + dx; click_y = py + dy;
            Term_keypress('\\'); Term_keypress('`');
        }
    }
    else if (line[0] == 'T' && line[1] == ' ')
    {
        /* right-click menu: aim at this square (a monster you can see there, else the square itself).
         * Only while the game waits for a command; the next "fire/cast/throw" can then use it with 't'. */
        int dx = 0, dy = 0, y, x;
        if (sscanf(line + 2, "%d %d", &dx, &dy) != 2) return;
        /* also taken while the game asks for a direction, so a click on the map can aim */
        if (character_icky || !character_generated || p_ptr->wild_mode) return;
        y = py + dy; x = px + dx;
        if (!in_bounds(y, x)) return;
        if (cave[y][x].m_idx && target_able(cave[y][x].m_idx))
        {
            health_track(cave[y][x].m_idx);
            target_who = cave[y][x].m_idx;
        }
        else target_who = -1;
        target_row = y; target_col = x;
        p_ptr->redraw |= PR_HEALTH_BARS;
        want_state = TRUE;
    }
    else if (line[0] == 'V' && line[1] == ' ')
    {
        int w = 0, h = 0;
        if (sscanf(line + 2, "%d %d", &w, &h) == 2)
        {
            view_w = MAX(21, MIN(w, 197));
            view_h = MAX(15, MIN(h, 99));
            want_state = TRUE;
        }
    }
    else if (line[0] == 'R' && line[1] == ' ')
    {
        int w = 0, h = 0;
        if (sscanf(line + 2, "%d %d", &w, &h) == 2)
        {
            if (w < 80) w = 80;
            if (h < 27) h = 27;
            if (w > SHELL_MAX_W) w = SHELL_MAX_W;
            if (h > SHELL_MAX_H) h = SHELL_MAX_H;
            want_w = w; want_h = h;
        }
    }
}

/* Read what the shell sent. Returns TRUE if anything was processed. */
static bool shell_pump(bool wait)
{
    bool got = FALSE;
    for (;;)
    {
        fd_set fds;
        struct timeval tv;
        int n, i, start;

        FD_ZERO(&fds);
        FD_SET(shell_sock, &fds);
        tv.tv_sec = wait ? 3600 : 0;
        tv.tv_usec = 0;
        n = select((int)shell_sock + 1, &fds, NULL, NULL, &tv);
        if (n <= 0) return got;

        n = recv(shell_sock, ibuf + ilen, sizeof(ibuf) - 1 - ilen, 0);
        if (n <= 0) shell_lost();
        ilen += n;

        start = 0;
        for (i = 0; i < ilen; i++)
        {
            if (ibuf[i] != '\n') continue;
            ibuf[i] = 0;
            shell_command(ibuf + start);
            start = i + 1;
            got = TRUE;
        }
        if (start) { memmove(ibuf, ibuf + start, ilen - start); ilen -= start; }
        if (ilen >= (int)sizeof(ibuf) - 1) ilen = 0;
        if (got) wait = FALSE;
    }
}

/* ----------------------------------------------------------------- state */
static void o_rect(cptr k, rect_t r)
{
    o_fmt("\"%s\":[%d,%d,%d,%d],", k, r.x, r.y, r.cx, r.cy);
}

static void send_dict(void)
{
    int i;
    o_raw("{\"t\":\"dict\",\"r\":[");
    for (i = 0; i < max_r_idx; i++)
    {
        monster_race *r = &r_info[i];
        o_raw("["); o_str(r->name ? r_name + r->name : ""); o_fmt(",%d,%d,%d,%d],", r->d_char, r->d_attr, r->level, (r->flags1 & RF1_UNIQUE) ? 1 : 0);
    }
    o_close(']');
    o_raw(",\"f\":[");
    for (i = 0; i < max_f_idx; i++)
    {
        feature_type *f = &f_info[i];
        o_raw("["); o_str(f->name ? f_name + f->name : ""); o_fmt(",%d,%d],", f->d_char[F_LIT_STANDARD], f->d_attr[F_LIT_STANDARD]);
    }
    o_close(']');
    o_raw(",\"k\":[");
    for (i = 0; i < max_k_idx; i++)
    {
        object_kind *k = &k_info[i];
        o_raw("["); o_str(k->name ? k_name + k->name : ""); o_fmt(",%d,%d,%d,%d,%d],", k->tval, k->sval, k->d_char, k->d_attr, k->flavor);
    }
    o_close(']');
    o_raw("}");
    o_send();
    dict_sent = TRUE;
    dict_seed = seed_flavor;
}

static void o_obj(obj_ptr o, char label)
{
    char name[MAX_NLEN];
    char lab[2];
    lab[0] = label; lab[1] = 0;
    object_desc(name, o, 0);
    o_raw("{");
    o_kstr("k", lab);
    o_kstr("n", name);
    o_kint("tv", o->tval);
    o_kint("sv", o->sval);
    o_kint("ki", o->k_idx);
    o_kint("num", o->number);
    o_kint("w", o->weight * o->number);
    o_kint("col", tval_to_attr[o->tval % 128]);
    if (object_is_artifact(o) && obj_is_known(o)) o_kint("art", 1);
    else if (o->name2 && obj_is_known(o)) o_kint("ego", 1);
    if (!obj_is_known(o)) o_kint("unk", 1);
    o_close('}');
    o_raw(",");
}

/* ------------------------------------------------- screens with a native layout */
#include "obj_prompt.h"
/* The item prompt (inventory, equipment, quiver, floor): called each time the game redraws it */
void shell_ui_items(vptr ctx)
{
    obj_prompt_context_ptr context = (obj_prompt_context_ptr)ctx;
    obj_prompt_tab_ptr tab;
    obj_p filter = context->prompt->filter;
    int i, start, stop;

    if (shell_sock == INVALID_SOCKET) return;
    o_raw("{\"t\":\"ui\",\"kind\":\"items\",");
    o_kstr("prompt", context->prompt->prompt ? context->prompt->prompt : "Choice:");
    o_kint("fail", (context->prompt->flags & INV_SHOW_FAIL_RATES) ? 1 : 0);
    o_raw("\"tabs\":[");
    for (i = 0; i < vec_length(context->tabs); i++)
    {
        tab = vec_get(context->tabs, i);
        o_raw("{");
        o_kstr("name", inv_name(tab->inv));
        o_kint("loc", inv_loc(tab->inv));
        o_kint("ct", tab->ct);
        if (i == context->tab) o_kint("on", 1);
        o_close('}');
        o_raw(",");
    }
    o_close(']');
    o_raw(",");
    tab = vec_get(context->tabs, context->tab);
    o_kint("page", tab->page + 1);
    o_kint("pages", tab->page_ct);
    o_kint("wgt", inv_weight(tab->inv, NULL));
    start = tab->page * context->page_size + 1;
    stop = (tab->page + 1) * context->page_size;
    if (inv_loc(tab->inv) == INV_EQUIP) stop = equip_max();
    else if (!filter) filter = obj_exists;
    o_raw("\"items\":[");
    for (i = start; i <= stop && i <= inv_max(tab->inv); i++)
    {
        obj_ptr o = inv_obj(tab->inv, i);
        char lab[2];
        if (filter && !o) continue;
        if (o && filter && !filter(o)) continue;
        lab[0] = inv_slot_label(tab->inv, i); lab[1] = 0;
        if (!lab[0]) lab[0] = ' ';
        o_raw("{");
        o_kstr("k", lab);
        if (inv_loc(tab->inv) == INV_EQUIP) o_kstr("slot", equip_describe_slot(i));
        if (o)
        {
            if (context->prompt->flags & INV_SHOW_FAIL_RATES)
            {
                if (object_is_aware(o) && (obj_is_identified_fully(o) || (o->known_xtra & OFL_DEVICE_FAIL)))
                {
                    int fail;
                    if (obj_is_device(o) || o->tval == TV_SCROLL) fail = device_calc_fail_rate(o);
                    else { effect_t effect = obj_get_effect(o); fail = effect_calc_fail_rate(&effect); }
                    o_kint("failr", fail);
                }
            }
            o_raw("\"o\":"); o_obj(o, lab[0]);
        }
        o_close('}');
        o_raw(",");
    }
    o_close(']');
    o_raw("}");
    o_send();
    ui_live = TRUE;
}
/* Generic builder used by game code: open, top-level fields, then rows of fields, close */
static int ui_rows = -1;
void shell_ui_open(cptr kind)
{
    if (shell_sock == INVALID_SOCKET) return;
    olen = 0; ui_rows = 0;
    o_raw("{\"t\":\"ui\",");
    o_kstr("kind", kind);
}
void shell_ui_str(cptr k, cptr v) { if (ui_rows < 0) return; o_kstr(k, v ? v : ""); }
void shell_ui_int(cptr k, int v) { if (ui_rows < 0) return; o_kint(k, v); }
void shell_ui_row(void)
{
    if (ui_rows < 0) return;
    if (ui_rows == 0) o_raw("\"rows\":[{");
    else { o_close('}'); o_raw(",{"); }
    ui_rows++;
}
void shell_ui_close(void)
{
    if (ui_rows < 0) return;
    if (ui_rows == 0) o_raw("\"rows\":[]}");
    else { o_close('}'); o_raw("]}"); }
    ui_rows = -1;
    ui_live = TRUE;
    o_send();
}
/* which row the game is now describing */
void shell_ui_sel(cptr name)
{
    if (shell_sock == INVALID_SOCKET) return;
    o_raw("{\"t\":\"uisel\",");
    o_kstr("name", name);
    o_close('}');
    o_send();
}
/* The whole level as known, for the level map screen */
void shell_ui_levelmap(void)
{
    int x, y;
    if (shell_sock == INVALID_SOCKET) return;
    if (!dict_sent) return;
    o_raw("{\"t\":\"ui\",\"kind\":\"lmap\",");
    o_kstr("place", map_name());
    o_kint("dlvl", dun_level);
    o_kint("w", cur_wid); o_kint("h", cur_hgt);
    o_kint("px", px); o_kint("py", py);
    o_kint("wild", p_ptr->wild_mode ? 1 : 0);
    o_raw("\"c\":[");
    for (y = 0; y < cur_hgt; y++)
    {
        for (x = 0; x < cur_wid; x++)
        {
            cave_type *c = &cave[y][x];
            int f = 0, m = 0, o = 0;
            if (c->info & CAVE_MARK) f = c->mimic ? c->mimic : c->feat;
            if (c->m_idx && m_list[c->m_idx].ml) m = m_list[c->m_idx].ap_r_idx;
            if (c->o_idx && (o_list[c->o_idx].marked & OM_FOUND)) o = o_list[c->o_idx].k_idx;
            if (m || o) o_fmt("[%d,%d,%d],", f, m, o);
            else o_fmt("%d,", f);
        }
    }
    o_close(']');
    o_raw("}");
    o_send();
    ui_live = TRUE;
}
void shell_ui_end(void)
{
    if (shell_sock == INVALID_SOCKET) return;
    ui_live = FALSE;
    o_raw("{\"t\":\"ui\",\"kind\":\"\"}");
    o_send();
}

static void send_state(void)
{
    int i, x, y;
    char buf[MAX_NLEN];
    rect_t mr = ui_map_rect();

    if (!character_generated) return;
    if (!dict_sent || (character_generated && dict_seed != seed_flavor)) send_dict();

    o_raw("{\"t\":\"s\",");
    o_kint("icky", character_icky ? 1 : 0);
    o_rect("rmap", mr);
    o_rect("rchar", ui_char_info_rect());
    o_rect("rstatus", ui_status_bar_rect());
    {
        rect_t r = msg_line_rect();
        if (r.cy < 1) r.cy = 1;
        o_rect("rmsg", r);
    }
    o_rect("reff", ui_effects_rect());

    /* ---- player */
    o_raw("\"p\":{");
    o_kstr("name", player_name);
    o_kstr("race", get_race()->name);
    o_kstr("cls", get_class()->name);
    o_kstr("pers", get_personality()->name);
    o_kstr("realm", p_ptr->realm1 ? realm_names[p_ptr->realm1] : "");
    o_kint("lev", p_ptr->lev);
    o_kint("exp", p_ptr->exp);
    o_kint("expNext", exp_requirement(p_ptr->lev));
    o_kint("au", p_ptr->au);
    o_kint("hp", p_ptr->chp); o_kint("mhp", p_ptr->mhp);
    o_kint("sp", p_ptr->csp); o_kint("msp", p_ptr->msp);
    o_kint("ac", p_ptr->dis_ac + p_ptr->dis_to_a);
    o_kint("speed", p_ptr->pspeed - 110); o_kint("lite", p_ptr->cur_lite);
    o_kint("wgt", py_total_weight()); o_kint("wlim", weight_limit());
    o_kstr("place", map_name());
    o_kint("dlvl", dun_level);
    {
        int d, h, m;
        extract_day_hour_min(&d, &h, &m);
        o_kint("day", d); o_kint("hour", h); o_kint("min", m);
    }
    o_raw("\"stats\":[");
    for (i = 0; i < 6; i++)
    {
        cnv_stat(p_ptr->stat_use[i], buf);
        o_str(buf); o_raw(",");
    }
    o_close(']');
    o_raw("},");

    /* ---- map: what stands on each square of the map view */
    o_fmt("\"py\":%d,\"px\":%d,", py, px);
    {
        /* where the player's square sits on the text grid, so the interface can line the two up */
        point_t up = cave_pt_to_ui_pt(point(px, py));
        o_fmt("\"gx\":%d,\"gy\":%d,", up.x, up.y);
    }
    if (!character_icky)
    {
        int hw = view_w / 2, hh = view_h / 2;
        o_fmt("\"map\":{\"w\":%d,\"h\":%d,\"c\":[", hw * 2 + 1, hh * 2 + 1);
        for (y = py - hh; y <= py + hh; y++)
        {
            for (x = px - hw; x <= px + hw; x++)
            {
                int f = 0, m = 0, o = 0, fl = 0;
                if (in_bounds2(y, x))
                {
                    cave_type *c = &cave[y][x];
                    if (c->info & CAVE_MARK) f = c->mimic ? c->mimic : c->feat;
                    if (player_can_see_bold(y, x)) { fl |= 1; f = c->mimic ? c->mimic : c->feat; }
                    if (c->info & CAVE_GLOW) fl |= 2;
                    if (c->info & (CAVE_LITE | CAVE_MNLT)) fl |= 8;
                    if (c->m_idx && m_list[c->m_idx].ml) m = m_list[c->m_idx].ap_r_idx;
                    if (c->o_idx && (o_list[c->o_idx].marked & OM_FOUND)) o = o_list[c->o_idx].k_idx;
                    if (y == py && x == px) { fl |= 5; f = c->mimic ? c->mimic : c->feat; }
                }
                if (m || o) o_fmt("[%d,%d,%d,%d],", f, fl, m, o);
                else if (f || fl) o_fmt("[%d,%d],", f, fl);
                else o_raw("0,");
            }
        }
        o_close(']');
        o_raw("},");
    }

    /* ---- monsters in view */
    o_raw("\"mons\":[");
    for (i = 1; i < m_max; i++)
    {
        monster_type *m = &m_list[i];
        monster_race *r;
        if (!m->r_idx || !m->ml) continue;
        r = &r_info[m->ap_r_idx];
        monster_desc(buf, m, MD_INDEF_VISIBLE | MD_ASSUME_VISIBLE);
        o_raw("{");
        o_kint("i", i);
        o_kint("r", m->ap_r_idx);
        o_kstr("n", buf);
        o_kint("hp", m->maxhp > 0 ? (long)m->hp * 100 / m->maxhp : 100);
        o_kint("rh", m->hp);
        { int lt = ((r->flags7 & (RF7_HAS_LITE_1 | RF7_SELF_LITE_1)) ? 1 : 0) + ((r->flags7 & (RF7_HAS_LITE_2 | RF7_SELF_LITE_2)) ? 2 : 0); if (lt) o_kint("lt", lt); }
        o_kstr("health", mon_health_desc(m));
        o_kint("dx", m->fx - px); o_kint("dy", m->fy - py);
        o_kint("dist", m->cdis);
        if (r->flags1 & RF1_UNIQUE) o_kint("uniq", 1);
        if (MON_CSLEEP(m)) o_kint("asleep", 1);
        if (MON_MONFEAR(m)) o_kint("afraid", 1);
        if (is_pet(m)) o_kint("pet", 1);
        else if (is_friendly(m)) o_kint("friendly", 1);
        if (target_who == i) o_kint("target", 1);
        if (projectable(py, px, m->fy, m->fx)) o_kint("los", 1);
        o_close('}');
        o_raw(",");
    }
    o_close(']');
    o_raw(",");

    /* ---- known objects on the floor nearby */
    o_raw("\"floor\":[");
    for (i = 1; i < o_max; i++)
    {
        object_type *o = &o_list[i];
        if (!o->k_idx || !(o->marked & OM_FOUND)) continue;
        if (o->held_m_idx) continue;
        if (o->loc.where != INV_FLOOR) continue;
        object_desc(buf, o, 0);
        o_raw("{");
        o_kstr("n", buf);
        o_kint("tv", o->tval);
        o_kint("ki", o->k_idx);
        o_kint("dx", o->loc.x - px); o_kint("dy", o->loc.y - py);
        o_kint("col", tval_to_attr[o->tval % 128]);
        o_close('}');
        o_raw(",");
    }
    o_close(']');
    o_raw(",");

    /* ---- worn */
    o_raw("\"equip\":[");
    for (i = 1; i <= equip_max(); i++)
    {
        obj_ptr o = equip_obj(i);
        char lab[2];
        lab[0] = slot_label(i); lab[1] = 0;
        o_raw("{");
        o_kstr("k", lab);
        o_kint("type", equip_slot_type(i));
        o_kstr("slot", equip_describe_slot(i));
        if (o) { o_raw("\"o\":"); o_obj(o, lab[0]); }
        o_close('}');
        o_raw(",");
    }
    o_close(']');
    o_raw(",");

    /* ---- carried */
    o_raw("\"pack\":[");
    for (i = 1; i <= pack_max(); i++)
    {
        obj_ptr o = pack_obj(i);
        if (o) o_obj(o, slot_label(i));
    }
    o_close(']');
    o_raw(",");

    /* ---- recent messages, oldest first */
    o_raw("\"msgs\":[");
    {
        int ct = msg_count();
        if (ct > 14) ct = 14;
        for (i = ct - 1; i >= 0; i--)
        {
            msg_ptr m = msg_get(i);
            if (!m) continue;
            o_raw("{");
            o_kstr("s", string_buffer(m->msg));
            o_kint("c", m->color);
            o_kint("n", m->count);
            o_kint("turn", m->turn);
            o_close('}');
            o_raw(",");
        }
    }
    o_close(']');
    o_raw("}");
    o_send();
}

static void send_frame(void)
{
    /* a native screen ends when the game is back to plain play */
    if (ui_live && !character_icky && ui_screen_depth() == 0)
    {
        ui_live = FALSE;
        o_raw("{\"t\":\"ui\",\"kind\":\"\",\"all\":1}");
        o_send();
    }

    term *t = Term;
    int w = t->wid, h = t->hgt, x, y, cx = 0, cy = 0;
    bool any = FALSE;

    if (w > SHELL_MAX_W) w = SHELL_MAX_W;
    if (h > SHELL_MAX_H) h = SHELL_MAX_H;

    {
        bool ov = (ui_screen_depth() > 0 && t->mem && character_generated);
        o_fmt("{\"t\":\"f\",\"w\":%d,\"h\":%d,\"icky\":%d,\"ov\":%d,", w, h, character_icky ? 1 : 0, ov ? 1 : 0);
        Term_locate(&cx, &cy);
        o_fmt("\"cx\":%d,\"cy\":%d,\"cv\":%d,", cx, cy, t->scr->cv ? 1 : 0);
        o_raw("\"rows\":[");
        for (y = 0; y < h; y++)
        {
            byte *a = t->scr->a[y];
            char *c = t->scr->c[y];
            static char rc[SHELL_MAX_W];
            for (x = 0; x < w; x++)
            {
                rc[x] = c[x] ? c[x] : ' ';
                /* a cell a pop-up has not touched is sent as "see through" */
                if (ov && a[x] == t->mem->a[y][x] && c[x] == t->mem->c[y][x]) rc[x] = 1;
            }
            if (old_valid && !memcmp(a, old_a[y], w) && !memcmp(rc, old_c[y], w)) continue;
            memcpy(old_a[y], a, w);
            memcpy(old_c[y], rc, w);
            any = TRUE;
            o_fmt("{\"y\":%d,\"s\":\"", y);
            for (x = 0; x < w; x++) o_chr((unsigned char)rc[x]);
            o_raw("\",\"a\":\"");
            o_need(w * 2 + 4);
            for (x = 0; x < w; x++) olen += sprintf(obuf + olen, "%02x", a[x]);
            o_raw("\"},");
        }
    }
    o_close(']');
    o_raw("}");
    old_valid = TRUE;
    (void)any;
    o_send();
}

static void send_hello(void)
{
    int i;
    o_raw("{\"t\":\"hello\",\"version\":");
    o_str(format("%d.%d.%s", VER_MAJOR, VER_MINOR, VER_PATCH));
    o_raw(",\"pal\":[");
    for (i = 0; i < 32; i++)
        o_fmt("\"#%02x%02x%02x\",", angband_color_table[i][1], angband_color_table[i][2], angband_color_table[i][3]);
    o_close(']');
    o_raw("}");
    o_send();
}

/* ------------------------------------------------------------ term hooks */
static void shell_resize_if_asked(void)
{
    if (want_w && want_h && (want_w != Term->wid || want_h != Term->hgt))
    {
        int w = want_w, h = want_h;
        want_w = want_h = 0;
        old_valid = FALSE;
        Term_resize(w, h);
        Term_redraw();
    }
    else want_w = want_h = 0;
}

static errr Term_xtra_shell(int n, int v)
{
    switch (n)
    {
        case TERM_XTRA_EVENT:
            if (v)
            {
                /* the interface keeps the player in the middle of the map */
                if (!center_player) center_player = TRUE;
                send_state();
                shell_pump(TRUE);
            }
            else shell_pump(FALSE);
            shell_resize_if_asked();
            return 0;
        case TERM_XTRA_FLUSH:
            while (shell_pump(FALSE)) /* drain */;
            return 0;
        case TERM_XTRA_FRESH:
            send_frame();
            /* while running, travelling or resting the game draws without waiting for a key:
             * send the state whenever you have moved, so the map shows you (not the text "@") every step */
            if (character_generated && !character_icky && !p_ptr->is_dead)
            {
                static int last_x = -1, last_y = -1;
                if (px != last_x || py != last_y)
                {
                    last_x = px; last_y = py;
                    send_state();
                }
            }
            return 0;
        case TERM_XTRA_REACT:
            send_hello();
            return 0;
        case TERM_XTRA_DELAY:
            if (v > 0)
            {
#ifdef WINDOWS
                Sleep(v);
#else
                usleep(1000 * v);
#endif
            }
            return 0;
        case TERM_XTRA_SOUND:
            if (shell_sock != INVALID_SOCKET) { char sb[40]; int sn = sprintf(sb, "{\"t\":\"snd\",\"v\":%d}\n", v); (void)send(shell_sock, sb, sn, 0); }   /* its own line; never mixed into a message being built */
            return 0;
        case TERM_XTRA_CLEAR:
        case TERM_XTRA_NOISE:
        case TERM_XTRA_SHAPE:
        case TERM_XTRA_FROSH:
        case TERM_XTRA_BORED:
        case TERM_XTRA_ALIVE:
        case TERM_XTRA_LEVEL:
            return 0;
    }
    return 1;
}

static errr Term_wipe_shell(int x, int y, int n) { (void)x; (void)y; (void)n; return 0; }
static errr Term_curs_shell(int x, int y) { (void)x; (void)y; return 0; }
static errr Term_text_shell(int x, int y, int n, byte a, cptr s) { (void)x; (void)y; (void)n; (void)a; (void)s; return 0; }

static void shell_nuke(term *t)
{
    (void)t;
    if (shell_sock != INVALID_SOCKET)
    {
        olen = 0;
        o_raw("{\"t\":\"bye\"}");
        o_send();
        sock_close(shell_sock);
        shell_sock = INVALID_SOCKET;
    }
}

errr init_shell(int argc, char **argv)
{
    term *t = &shell_term;
    struct sockaddr_in addr;
    cptr port = getenv("FROG_SHELL_PORT");
    int one = 1, cols = 120, rows = 40;

    (void)argc; (void)argv;
    if (!port) return 1;

#ifdef WINDOWS
    {
        WSADATA wsa;
        if (WSAStartup(MAKEWORD(2, 2), &wsa)) return 1;
    }
#endif
    shell_sock = socket(AF_INET, SOCK_STREAM, 0);
    if (shell_sock == INVALID_SOCKET) return 1;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons((unsigned short)atoi(port));
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(shell_sock, (struct sockaddr *)&addr, sizeof(addr)) != 0)
    {
        sock_close(shell_sock);
        shell_sock = INVALID_SOCKET;
        return 1;
    }
    setsockopt(shell_sock, IPPROTO_TCP, TCP_NODELAY, (const char *)&one, sizeof(one));

    if (getenv("FROG_SHELL_COLS")) cols = atoi(getenv("FROG_SHELL_COLS"));
    if (getenv("FROG_SHELL_ROWS")) rows = atoi(getenv("FROG_SHELL_ROWS"));
    if (cols < 80) cols = 80;
    if (rows < 27) rows = 27;
    if (cols > SHELL_MAX_W) cols = SHELL_MAX_W;
    if (rows > SHELL_MAX_H) rows = SHELL_MAX_H;

    term_init(t, cols, rows, 1024);
    t->soft_cursor = TRUE;
    t->never_bored = TRUE;
    t->never_frosh = TRUE;
    t->attr_blank = TERM_WHITE;
    t->char_blank = ' ';
    t->xtra_hook = Term_xtra_shell;
    t->wipe_hook = Term_wipe_shell;
    t->curs_hook = Term_curs_shell;
    t->text_hook = Term_text_shell;
    t->nuke_hook = shell_nuke;

    angband_term[0] = t;
    Term_activate(t);

    send_hello();
    return 0;
}

#endif /* USE_SHELL */
