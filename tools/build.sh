#!/usr/bin/env bash
# Сборка модуля: компендиумы → dist/mymothership.zip. В архив идёт всё, что нужно Foundry, и ничего лишнего.
# Перед сборкой: npm install (один раз). Проверка архива: npm test.
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/pack.mjs
mkdir -p dist
rm -f dist/mymothership.zip
zip -qr -X dist/mymothership.zip module.json README.md scripts lang styles packs assets -x "*.DS_Store" "packs/*/LOCK" "packs/*/LOG*"
echo "dist/mymothership.zip: $(unzip -l dist/mymothership.zip | tail -1)"
