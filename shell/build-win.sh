#!/bin/sh
# Cross-builds the game for Windows (64-bit) with the interface bridge. Needs mingw-w64.
# usage: sh shell/build-win.sh [outdir]
set -e
cd "$(dirname "$0")/../src"
OUT=${1:-../build-win}; OBJ=${OBJDIR:-$OUT/obj}; mkdir -p "$OBJ"
CC=x86_64-w64-mingw32-gcc
CFLAGS="-O2 -DUSE_SHELL -DWINDOWS -DWIN32 -fcommon -w -I."
SKIP="main-win.c main-gcu.c main-x11.c main-sdl.c main-cap.c main-crb.c main-dos.c main-ibm.c main-emx.c main-mac.c main-ami.c main-lsl.c main-sla.c main-vcs.c main-xaw.c main-xpj.c main-xxx.c main-vme.c main-acn.c main-ros.c main-gtk.c main-tnb.c main-dll.c readdib.c maid-x11.c snd-sdl.c z-doc-test.c"
LIST=""
for f in *.c; do
  case " $SKIP " in *" $f "*) continue;; esac
  o="$OBJ/${f%.c}.o"
  if [ ! -f "$o" ] || [ "$f" -nt "$o" ] || [ externs.h -nt "$o" ]; then LIST="$LIST $f"; fi
done
[ -n "$LIST" ] && printf '%s\n' $LIST | xargs -P 8 -I{} sh -c "$CC $CFLAGS -c {} -o $OBJ/\$(basename {} .c).o || echo FAILED {}"
x86_64-w64-mingw32-windres frogcomposband.rc -O coff -o "$OBJ/frog.res" 2>/dev/null || true
RES=""; [ -f "$OBJ/frog.res" ] && RES="$OBJ/frog.res"
$CC -o "$OUT/frogcomposband.exe" "$OBJ"/*.o $RES -lws2_32 -lwinmm -mwindows -static
echo "built $OUT/frogcomposband.exe"
