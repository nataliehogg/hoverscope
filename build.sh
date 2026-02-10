#!/bin/bash
# Build Firefox and Chrome extension zips for the current version.
# Usage: ./build.sh

set -e

VERSION=$(python3 -c "import json; print(json.load(open('manifest.firefox.json'))['version'])")
echo "Building Hoverscope v${VERSION}..."

EXCLUDE=(
    "*.git*"
    "*.zip"
    "*.py"
    "*.sh"
    "*.code-workspace"
    ".claude/*"
    "manifest.chrome.json"
    "manifest.firefox.json"
)

# Build exclude flags for zip
EXCLUDE_FLAGS=()
for pattern in "${EXCLUDE[@]}"; do
    EXCLUDE_FLAGS+=("--exclude" "$pattern")
done

# Firefox
cp manifest.firefox.json manifest.json
zip -r "hoverscope-firefox-v${VERSION}.zip" . "${EXCLUDE_FLAGS[@]}"
echo "  Created hoverscope-firefox-v${VERSION}.zip"

# Chrome
cp manifest.chrome.json manifest.json
zip -r "hoverscope-chrome-v${VERSION}.zip" . "${EXCLUDE_FLAGS[@]}"
echo "  Created hoverscope-chrome-v${VERSION}.zip"

# Restore Firefox manifest for development
cp manifest.firefox.json manifest.json
echo "  Restored manifest.json to Firefox version"

echo "Done."
