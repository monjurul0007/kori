#!/usr/bin/env bash
# Placeholder lettermark icons, rendered from public/icon.svg with headless Chromium.
# Replace with the real logo later (Trello: "Design the Kori logo and app icons").
# Usage: CHROME=/path/to/chrome scripts/gen-icons.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-chromium}"
render() { # size, safe-zone scale (1 = full bleed), output
  local tmp; tmp="$(mktemp --suffix=.html)"
  cat > "$tmp" <<HTML
<style>html,body{margin:0;background:#0c6e51}img{display:block;width:100vw;height:100vh}</style>
<body><div style="width:$1px;height:$1px;overflow:hidden"><img src="file://$PWD/public/icon.svg" style="width:$1px;height:$1px;transform:scale($2)"></div></body>
HTML
  "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --window-size="$1,$1" --screenshot="$3" "file://$tmp" > /dev/null 2>&1
  rm -f "$tmp"
}
render 192 1 public/icon-192.png
render 512 1 public/icon-512.png
render 512 0.8 public/icon-maskable-512.png # the K stays inside the 80% safe zone
render 180 1 public/apple-touch-icon.png
