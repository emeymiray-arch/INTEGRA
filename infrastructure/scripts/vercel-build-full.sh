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
API_BUNDLE="$ROOT/apps/api/dist/serverless.bundle.js"

if [ ! -f "$WEB_DIST/index.html" ]; then
  echo "[integra] ERROR: missing $WEB_DIST/index.html"
  exit 1
fi

if [ ! -f "$API_HANDLER" ]; then
  echo "[integra] ERROR: missing $API_HANDLER"
  ls -la "$ROOT/apps/api/dist" || true
  exit 1
fi

echo "[integra] bundling Nest serverless handler"
npx --yes esbuild@0.25.0 "$API_HANDLER" \
  --bundle \
  --minify \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile="$API_BUNDLE" \
  --external:@prisma/client \
  --external:.prisma/client \
  --external:pg-native \
  --external:@nestjs/microservices \
  --external:@nestjs/microservices/microservices-module \
  --external:@nestjs/websockets \
  --external:@nestjs/websockets/socket-module \
  --external:class-transformer/storage

resolve_pkg_dir() {
  local pkg="$1"
  (
    cd "$ROOT/apps/api"
    node -e "process.stdout.write(require('path').dirname(require.resolve(process.argv[1]+'/package.json')))" "$pkg"
  )
}

PRISMA_CLIENT_DIR="$(resolve_pkg_dir @prisma/client)"
PRISMA_DOT_DIR="$(
  cd "$ROOT/apps/api"
  node <<'NODE'
const fs = require('fs');
const path = require('path');
const client = path.dirname(require.resolve('@prisma/client/package.json'));
const candidates = [
  path.resolve(client, '..', '..', '.prisma', 'client'),
  path.join(client, '.prisma', 'client'),
  path.resolve(process.cwd(), '..', '..', 'node_modules', '.prisma', 'client'),
];
for (const c of candidates) {
  if (fs.existsSync(path.join(c, 'package.json')) || fs.existsSync(path.join(c, 'index.js'))) {
    process.stdout.write(c);
    process.exit(0);
  }
}
process.exit(0);
NODE
)"

echo "[integra] prisma client: $PRISMA_CLIENT_DIR"
echo "[integra] prisma engine dir: ${PRISMA_DOT_DIR:-none}"

OUT="$ROOT/.vercel/output"
rm -rf "$OUT"
mkdir -p "$OUT/static"
mkdir -p "$OUT/functions/api.func/node_modules/@prisma"
mkdir -p "$OUT/functions/api.func/node_modules/.prisma"

cp -R "$WEB_DIST"/. "$OUT/static/"
cp "$API_BUNDLE" "$OUT/functions/api.func/handler.js"
cp -R "$PRISMA_CLIENT_DIR" "$OUT/functions/api.func/node_modules/@prisma/client"

if [ -n "${PRISMA_DOT_DIR:-}" ] && [ -d "$PRISMA_DOT_DIR" ]; then
  cp -R "$PRISMA_DOT_DIR" "$OUT/functions/api.func/node_modules/.prisma/client"
fi

FUNC="$OUT/functions/api.func"
# Keep only PostgreSQL client-engine assets; drop other DB wasms + rust binaries.
find "$FUNC/node_modules" \( -name "*.map" -o -name "*.d.ts" -o -name "*.md" \) -type f -delete 2>/dev/null || true
find "$FUNC/node_modules" -type f \( \
  -name "libquery_engine-*" -o \
  -name "*.dylib.node" -o \
  -name "*.so.node" -o \
  -name "*cockroachdb*" -o \
  -name "*mysql*" -o \
  -name "*sqlserver*" -o \
  -name "*sqlite*" -o \
  -name "binary.js" -o \
  -name "binary.mjs" -o \
  -name "react-native.js" -o \
  -name "edge.js" -o \
  -name "edge.mjs" -o \
  -name "wasm-compiler-edge.*" \
\) -delete 2>/dev/null || true
# Prefer .js over duplicate .mjs wasm payloads where both exist.
find "$FUNC/node_modules/@prisma/client/runtime" -type f -name "*.mjs" -delete 2>/dev/null || true
rm -rf "$FUNC/node_modules/@prisma/client/generator-build" \
       "$FUNC/node_modules/@prisma/client/scripts" 2>/dev/null || true
du -sh "$FUNC"

cat > "$OUT/functions/api.func/index.js" <<'EOF'
'use strict';
try {
  const mod = require('./handler.js');
  module.exports = typeof mod === 'function' ? mod : mod.default;
} catch (error) {
  module.exports = async function failingHandler(_req, res) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error('[INTEGRA] Failed to load serverless handler:', message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        data: null,
        error: {
          code: 'HANDLER_LOAD_FAILED',
          message,
          hasDbUrl: Boolean(process.env.DATABASE_URL),
          node: process.version,
        },
      }),
    );
  };
}
EOF

cat > "$OUT/functions/api.func/.vc-config.json" <<'EOF'
{
  "runtime": "nodejs20.x",
  "handler": "index.js",
  "launcherType": "Nodejs",
  "shouldAddHelpers": false,
  "maxDuration": 60,
  "supportsResponseStreaming": false
}
EOF

cat > "$OUT/config.json" <<'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api(?:/(.*))?$", "dest": "/api" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF

rm -rf "$ROOT/public" "$ROOT/apps/api/public"
mkdir -p "$ROOT/public" "$ROOT/apps/api/public"
cp -R "$WEB_DIST"/. "$ROOT/public/"
cp -R "$WEB_DIST"/. "$ROOT/apps/api/public/"

echo "[integra] Build Output API ready"
du -sh "$OUT" "$OUT/functions/api.func" "$OUT/static"

API_OUT="$ROOT/apps/api/.vercel/output"
rm -rf "$API_OUT"
mkdir -p "$ROOT/apps/api/.vercel"
cp -R "$OUT" "$API_OUT"
SIZE=$(du -sh "$API_OUT" | cut -f1)
echo "[integra] mirrored Build Output to $API_OUT ($SIZE)"
