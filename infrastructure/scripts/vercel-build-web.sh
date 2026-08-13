#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

echo "[integra] monorepo root: $ROOT"

pnpm exec turbo run build --filter=@integra/shared --filter=@integra/web

WEB_DIST="$ROOT/apps/web/dist"
if [ ! -f "$WEB_DIST/index.html" ]; then
  echo "[integra] ERROR: missing $WEB_DIST/index.html"
  exit 1
fi

rm -rf "$ROOT/dist" "$ROOT/public"
mkdir -p "$ROOT/public"
cp -R "$WEB_DIST"/. "$ROOT/public/"

# Also publish root/dist for Turbo default outputDirectory detection
mkdir -p "$ROOT/dist"
cp -R "$WEB_DIST"/. "$ROOT/dist/"

if [ -d "$ROOT/apps/api" ]; then
  rm -rf "$ROOT/apps/api/dist-web"
  mkdir -p "$ROOT/apps/api/dist-web"
  cp -R "$WEB_DIST"/. "$ROOT/apps/api/dist-web/"
fi

echo "[integra] web artifacts ready"
ls -la "$ROOT/public" | head -15
