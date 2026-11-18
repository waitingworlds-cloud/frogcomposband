# Tileset for the interface

Put `atlas.json` and its PNG sheets in this folder. Without it the interface
draws its own placeholder shapes, so a partial set is fine: anything not listed
falls back to the placeholder.

```json
{
  "tile": 64,
  "images": ["monsters.png", "items.png", "terrain.png"],
  "mon":    { "cave spider": [0, 3, 0], "grip, farmer maggot's dog": [0, 4, 0] },
  "obj":    { "dagger": [1, 0, 0], "ration of food": [1, 1, 0] },
  "feat":   { "granite wall": [2, 0, 0], "open floor": [2, 1, 0], "class:wall": [2, 0, 0] },
  "player": { "default": [0, 0, 0], "hobbit rogue": [0, 1, 0], "rogue": [0, 2, 0] }
}
```

- An entry is `[image index, column, row]`, counted in tiles, with optional
  `[.., width, height]` in tiles for sprites bigger than one square (they stand
  on the bottom middle of their square).
- Keys are the game's own names, lower case, without a leading a/an/the:
  monster names from `lib/edit/r_info.txt`, item kind names from `k_info.txt`
  (with the `&`, `~` and `#` marks removed: `& Ration~ of Food` is `ration of food`), terrain names from
  `f_info.txt`.
- `feat` may also hold `class:<kind>` fallbacks used when a terrain has no
  entry of its own: wall, floor, door, dooropen, up, down, water, lava, tree,
  grass, rubble, pit, trap, shop, snow, other.
- `player` is looked up by "race class", then class, then race, then "default".
- Sprites need a transparent background. Terrain tiles should fill the square.
- Remembered but unseen squares are darkened by the interface; do not bake
  lighting into the art.
