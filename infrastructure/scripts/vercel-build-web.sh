#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

echo "[integra] monorepo root: $ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

pnpm exec turbo run build --filter=@integra/web

WEB_DIST="$ROOT/apps/web/dist"
if [ ! -f "$WEB_DIST/index.html" ]; then
  echo "[integra] ERROR: missing $WEB_DIST/index.html"
  find "$ROOT/apps/web" -maxdepth 3 -type d -print || true
  exit 1
fi

# Publish to monorepo-root/dist (Root Directory = ".")
rm -rf "$ROOT/dist"
mkdir -p "$ROOT/dist"
cp -R "$WEB_DIST"/. "$ROOT/dist/"
echo "[integra] published $ROOT/dist"

# If Vercel Root Directory is apps/web, ./dist already exists as Vite outDir.
# If Root Directory is apps/api, also publish there so "dist" is found.
if [ -d "$ROOT/apps/api" ]; then
  rm -rf "$ROOT/apps/api/dist"
  mkdir -p "$ROOT/apps/api/dist"
  cp -R "$WEB_DIST"/. "$ROOT/apps/api/dist/"
  echo "[integra] published $ROOT/apps/api/dist"
fi

echo "[integra] done"
