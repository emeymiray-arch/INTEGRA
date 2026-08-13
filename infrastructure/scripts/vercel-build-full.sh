#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

echo "[integra] monorepo root: $ROOT"

PNPM_BIN="pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  PNPM_BIN="npx pnpm@9.15.0"
fi

$PNPM_BIN exec turbo run build --filter=@integra/shared --filter=@integra/api --filter=@integra/web

WEB_DIST="$ROOT/apps/web/dist"
API_HANDLER="$ROOT/apps/api/dist/serverless.js"

if [ ! -f "$WEB_DIST/index.html" ]; then
  echo "[integra] ERROR: missing $WEB_DIST/index.html"
  exit 1
fi

if [ ! -f "$API_HANDLER" ]; then
  echo "[integra] ERROR: missing $API_HANDLER"
  ls -la "$ROOT/apps/api/dist" || true
  exit 1
fi

rm -rf "$ROOT/public"
mkdir -p "$ROOT/public"
cp -R "$WEB_DIST"/. "$ROOT/public/"

# Ensure Vercel can resolve the serverless entry
mkdir -p "$ROOT/api"
cat > "$ROOT/api/index.js" <<'EOF'
module.exports = require('../apps/api/dist/serverless.js');
EOF

echo "[integra] web → public/, api → api/index.js"
ls -la "$ROOT/public" | head -10
ls -la "$ROOT/api"
ls -la "$ROOT/apps/api/dist/serverless.js"
