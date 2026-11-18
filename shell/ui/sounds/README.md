# Sound clips (optional)

The interface synthesizes every sound by itself. Recorded clips placed here replace the
synthesized voice of the same name: `index.json` is `{ "<voice>": [{ "f": "file.ogg", "g": 0.8 }] }`
(voices are listed in `../sound.js`; `bed:deep` is the looping dungeon air). Clips are not kept in
the repository; `SOUNDS=<folder> sh shell/package-win.sh ...` copies a set into a build.
