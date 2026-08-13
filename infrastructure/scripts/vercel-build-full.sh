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

# Root deploy (Root Directory = ".")
rm -rf "$ROOT/public"
mkdir -p "$ROOT/public"
cp -R "$WEB_DIST"/. "$ROOT/public/"

mkdir -p "$ROOT/api"
cat > "$ROOT/api/index.js" <<'EOF'
'use strict';
try {
  require('reflect-metadata');
  const mod = require('../apps/api/dist/serverless.js');
  module.exports = typeof mod === 'function' ? mod : mod.default;
} catch (error) {
  module.exports = async function failingHandler(_req, res) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[INTEGRA] Failed to load serverless handler:', message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: null, error: { code: 'HANDLER_LOAD_FAILED', message } }));
  };
}
EOF

# apps/api deploy (Root Directory = "apps/api")
rm -rf "$ROOT/apps/api/public"
mkdir -p "$ROOT/apps/api/public"
cp -R "$WEB_DIST"/. "$ROOT/apps/api/public/"

mkdir -p "$ROOT/apps/api/api"
cat > "$ROOT/apps/api/api/index.js" <<'EOF'
'use strict';
try {
  require('reflect-metadata');
  const mod = require('../dist/serverless.js');
  module.exports = typeof mod === 'function' ? mod : mod.default;
} catch (error) {
  module.exports = async function failingHandler(_req, res) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[INTEGRA] Failed to load serverless handler:', message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: null, error: { code: 'HANDLER_LOAD_FAILED', message } }));
  };
}
EOF

echo "[integra] staged public/ + api/ for root and apps/api"
ls -la "$ROOT/public/index.html" "$ROOT/api/index.js" "$ROOT/apps/api/public/index.html" "$ROOT/apps/api/api/index.js" "$API_HANDLER"
