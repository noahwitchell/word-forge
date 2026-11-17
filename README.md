# Word Forge

A phone word game: seven letters, find as many words as you can. The word bank shows how many words of each length are left. Works offline and installs to the home screen.

Play: https://noahwitchell.github.io/word-forge/

## Build

Word lists go in `_lists/` (not committed):

- `enable1.txt`: ENABLE word list (public domain), https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
- `en_50k.txt`: English frequency list from hermitdave/FrequencyWords (OpenSubtitles 2018), https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt

Then `python3 src/build.py` writes `app.html` and the web app in `docs/` (served by GitHub Pages). `python3 src/make_icons.py` redraws the icons.
