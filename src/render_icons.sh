#!/bin/zsh
# Renders src/icon.html (white tile, gold border, "WF" in DM Serif Display) to the PNG sizes phones need, using headless Chrome.
cd "${0:A:h}/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p docs
for s in 180 192 512; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=2000 \
    --window-size=$s,$s --screenshot="$PWD/docs/icon-$s.png" "file://$PWD/src/icon.html" >/dev/null 2>&1
done
mv docs/icon-180.png docs/apple-touch-icon.png
ls -la docs/*.png
