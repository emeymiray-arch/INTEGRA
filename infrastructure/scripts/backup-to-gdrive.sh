#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y-%m-%d_%H-%M)
DUMP_FILE="integra_${DATE}.sql.gz"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

mkdir -p "$BACKUP_DIR"

echo "Creating database dump..."
pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/${DUMP_FILE}"

echo "Backup saved: ${BACKUP_DIR}/${DUMP_FILE}"

# Google Drive upload (requires rclone or gdrive CLI configured)
if command -v rclone &>/dev/null && [ -n "${GDRIVE_REMOTE:-}" ]; then
  echo "Uploading to Google Drive..."
  rclone copy "${BACKUP_DIR}/${DUMP_FILE}" "${GDRIVE_REMOTE}:INTEGRA/backups/${DATE}/"
  echo "Upload complete."
else
  echo "Skipping Google Drive upload (set GDRIVE_REMOTE and configure rclone)."
fi

# Retention: keep last 30 days
find "$BACKUP_DIR" -name "integra_*.sql.gz" -mtime +30 -delete 2>/dev/null || true

echo "Done."
