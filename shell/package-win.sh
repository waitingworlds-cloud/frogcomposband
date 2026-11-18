#!/bin/sh
# Builds the ready-to-run Windows folder and zip.
# usage: [TILES=<tileset folder>] sh shell/package-win.sh <electron-win32-x64.zip> <outdir>
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(dirname "$HERE")"
EZIP="$1"; OUT="${2:-$REPO/dist}"; APP="$OUT/FrogComposband"
rm -rf "$APP"; mkdir -p "$APP"
unzip -q "$EZIP" -d "$APP"
mv "$APP/electron.exe" "$APP/FrogComposband.exe"
rm -f "$APP/resources/default_app.asar"
mkdir -p "$APP/resources/app" "$APP/game"
cp "$HERE/main.js" "$HERE/server.js" "$HERE/package.json" "$APP/resources/app/"
cp -r "$HERE/ui" "$APP/resources/app/ui"
# TILES=<folder with atlas.json and its sheets> puts a tileset into the build
if [ -n "$SOUNDS" ]; then cp "$SOUNDS"/index.json "$SOUNDS"/*.ogg "$APP/resources/app/ui/sounds/"; fi
if [ -n "$TILES" ]; then cp "$TILES"/atlas.json "$TILES"/*.png "$APP/resources/app/ui/tiles/"; fi
OBJDIR="${OBJDIR:-$OUT/obj}" sh "$HERE/build-win.sh" "$APP/game"
rm -rf "$APP/game/obj"
(cd "$REPO" && git archive HEAD lib) | tar -x -C "$APP/game"
cp "$HERE/README-windows.txt" "$APP/README.txt"
(cd "$OUT" && rm -f FrogComposband-windows-x64.zip && zip -qr FrogComposband-windows-x64.zip FrogComposband)
ls -la "$OUT/FrogComposband-windows-x64.zip"
