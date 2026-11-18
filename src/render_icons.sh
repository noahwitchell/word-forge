#!/bin/zsh
# Renders src/icon.html (white tile, gold border, "WF" in DM Serif Display) with headless Chrome at 1024,
# then scales down to the sizes phones need. (Chrome won't lay out a window narrower than ~500px, so small
# sizes must NOT be rendered directly: they come out as a cropped corner.)
cd "${0:A:h}/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=2000 \
  --window-size=1024,1024 --screenshot="$TMP/icon-1024.png" "file://$PWD/src/icon.html" >/dev/null 2>&1
mkdir -p docs
python3 - "$TMP/icon-1024.png" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
assert im.size == (1024, 1024), im.size
for s, name in ((512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')):
    im.resize((s, s), Image.LANCZOS).save('docs/' + name, optimize=True)
PY
rm -rf "$TMP"
sips -g pixelWidth -g pixelHeight docs/*.png | paste - - -
