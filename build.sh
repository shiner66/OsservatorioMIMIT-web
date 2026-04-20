#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> [1/3] Build frontend (Vite)"
pushd frontend >/dev/null
if [ ! -d node_modules ]; then
  npm install
fi
npm run build
popd >/dev/null

echo "==> [2/3] Copia assets in backend/static"
rm -rf backend/static
cp -r frontend/dist backend/static

echo "==> [3/3] Build eseguibile con PyInstaller"
python3 -m pip install --quiet --disable-pip-version-check pyinstaller -r requirements.txt
python3 -m PyInstaller carburanti.spec --clean --noconfirm

echo ""
echo "Fatto. Eseguibile in: dist/carburanti"
echo "Avvia con: ./dist/carburanti   (si aprirà il browser su http://localhost:8765)"
