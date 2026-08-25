#!/usr/bin/env bash
# Thin wrapper kept for compatibility. Prefer: pnpm db:backup
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$ROOT/infrastructure/scripts/backup-to-gdrive.mjs"
