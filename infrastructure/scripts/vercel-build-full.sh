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
  --external:@nestjs/microservices \
  '--external:@nestjs/microservices/*' \
  --external:@nestjs/websockets \
  '--external:@nestjs/websockets/*' \
  --external:class-transformer/storage

# Resolve Prisma package roots from the workspace (pnpm-safe).
PRISMA_CLIENT_DIR="$(
  cd "$ROOT/apps/api"
  node -e "process.stdout.write(require('path').dirname(require.resolve('@prisma/client/package.json')))"
)"
PRISMA_DOT_DIR="$(
  cd "$ROOT/apps/api"
  node <<'NODE'
const fs = require('fs');
const path = require('path');
const client = path.dirname(require.resolve('@prisma/client/package.json'));
const candidates = [
  path.resolve(client, '..', '..', '.prisma', 'client'),
  path.join(client, '.prisma', 'client'),
  path.join(client, 'node_modules', '.prisma', 'client'),
  path.resolve(client, '..', '.prisma', 'client'),
  path.resolve(process.cwd(), 'node_modules', '.prisma', 'client'),
  path.resolve(process.cwd(), '..', '..', 'node_modules', '.prisma', 'client'),
];
for (const c of candidates) {
  if (fs.existsSync(path.join(c, 'index.js'))) {
    process.stdout.write(c);
    process.exit(0);
  }
}
console.error('[integra] ERROR: .prisma/client not found. Tried:\n' + candidates.join('\n'));
process.exit(1);
NODE
)"

echo "[integra] prisma client: $PRISMA_CLIENT_DIR"
echo "[integra] prisma engine: $PRISMA_DOT_DIR"

OUT="$ROOT/.vercel/output"
rm -rf "$OUT"
mkdir -p "$OUT/static"
mkdir -p "$OUT/functions/api.func/node_modules/@prisma"
mkdir -p "$OUT/functions/api.func/node_modules/.prisma"

cp -R "$WEB_DIST"/. "$OUT/static/"

# Self-contained serverless function (no fragile includeFiles / ../../ paths).
cp "$API_BUNDLE" "$OUT/functions/api.func/handler.js"
cp -R "$PRISMA_CLIENT_DIR" "$OUT/functions/api.func/node_modules/@prisma/client"
cp -R "$PRISMA_DOT_DIR" "$OUT/functions/api.func/node_modules/.prisma/client"

FUNC="$OUT/functions/api.func"
# Drop non-runtime Prisma bulk so the function stays under Vercel's ~50MB limit.
find "$FUNC/node_modules/@prisma/client" \
  \( -name '*.map' -o -name '*.d.ts' -o -name '*.wasm' -o -name '*.wasm-base64.js' -o -name '*.wasm-base64.mjs' -o -name '*.md' \) \
  -type f -delete
find "$FUNC/node_modules/@prisma/client/runtime" -type f \( -name '*wasm*' -o -name '*.map' -o -name '*.mjs' \) -delete || true
find "$FUNC/node_modules/.prisma/client" -type f \( \
  -name 'libquery_engine-darwin*' -o \
  -name '*.dylib.node' -o \
  -name '*.wasm' -o \
  -name '*.d.ts' -o \
  -name '*.map' \
\) -delete
rm -rf "$FUNC/node_modules/@prisma/client/generator-build" \
       "$FUNC/node_modules/@prisma/client/scripts" \
       "$FUNC/node_modules/@prisma/client/examples" 2>/dev/null || true

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
    { "src": "/api(?:/.*)?$", "dest": "/api" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF

# Keep legacy public/ for projects still using outputDirectory.
rm -rf "$ROOT/public" "$ROOT/apps/api/public"
mkdir -p "$ROOT/public" "$ROOT/apps/api/public"
cp -R "$WEB_DIST"/. "$ROOT/public/"
cp -R "$WEB_DIST"/. "$ROOT/apps/api/public/"

# Legacy api handlers (unused when Build Output API is present).
mkdir -p "$ROOT/api" "$ROOT/apps/api/api"
cp "$OUT/functions/api.func/index.js" "$ROOT/api/index.js"
cp "$OUT/functions/api.func/handler.js" "$ROOT/api/handler.js"
cp "$OUT/functions/api.func/index.js" "$ROOT/apps/api/api/index.js"
cp "$OUT/functions/api.func/handler.js" "$ROOT/apps/api/api/handler.js"

echo "[integra] Build Output API ready"
du -sh "$OUT" "$OUT/functions/api.func" "$OUT/static"
ls -la "$OUT/functions/api.func" | head -20

# Vercel Root Directory is often "apps/api" — it only reads apps/api/.vercel/output.
# Without this copy the deploy serves nothing → NOT_FOUND / "The page could not be found".
API_OUT="$ROOT/apps/api/.vercel/output"
rm -rf "$API_OUT"
mkdir -p "$ROOT/apps/api/.vercel"
cp -R "$OUT" "$API_OUT"
echo "[integra] mirrored Build Output to $API_OUT"
du -sh "$API_OUT"
