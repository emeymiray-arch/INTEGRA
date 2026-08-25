#!/usr/bin/env node
/**
 * Dump PostgreSQL and upload the gzip archive to Google Drive.
 *
 * Required env:
 *   DATABASE_URL
 *   GOOGLE_DRIVE_FOLDER_ID
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON  (raw JSON or base64)
 *
 * Optional:
 *   BACKUP_DIR  (default: ./backups)
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { google } = require('googleapis');

const ROOT = path.resolve(__dirname, '../..');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(ROOT, 'backups');

function fail(message) {
  console.error(`[backup] ${message}`);
  process.exit(1);
}

function parseServiceAccountJson(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.private_key && parsed.private_key.includes('\\n')) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (parsed.private_key && parsed.private_key.includes('\\n')) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch {
      return null;
    }
  }
}

async function ensureChildFolder(drive, parentId, name) {
  const safeName = name.replace(/'/g, "\\'");
  const listed = await drive.files.list({
    q: `'${parentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existing = listed.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Cannot create folder ${name}`);
  return created.data.id;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const credentials = parseServiceAccountJson(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);

  if (!databaseUrl) fail('DATABASE_URL is required');
  if (!folderId) fail('GOOGLE_DRIVE_FOLDER_ID is required');
  if (!credentials?.client_email || !credentials?.private_key) {
    fail('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is required (service account JSON)');
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dateFolder = stamp.slice(0, 10);
  const dumpName = `integra_${stamp}.sql.gz`;
  const dumpPath = path.join(BACKUP_DIR, dumpName);

  console.log(`[backup] Dumping database to ${dumpPath}`);
  const dump = spawnSync(
    'bash',
    ['-lc', `pg_dump "$DATABASE_URL" | gzip > "${dumpPath}"`],
    {
      env: process.env,
      encoding: 'utf8',
    },
  );
  if (dump.status !== 0) {
    fail(dump.stderr || dump.stdout || 'pg_dump failed (is PostgreSQL client installed?)');
  }

  const buffer = fs.readFileSync(dumpPath);
  console.log(`[backup] Dump size ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const backupsId = await ensureChildFolder(drive, folderId, 'backups');
  const dayId = await ensureChildFolder(drive, backupsId, dateFolder);

  console.log(`[backup] Uploading to Drive backups/${dateFolder}/${dumpName}`);
  const created = await drive.files.create({
    requestBody: {
      name: dumpName,
      parents: [dayId],
    },
    media: {
      mimeType: 'application/gzip',
      body: Readable.from(buffer),
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  console.log(`[backup] Uploaded file id=${created.data.id}`);

  // Retention: keep last 30 local dumps
  for (const file of fs.readdirSync(BACKUP_DIR)) {
    if (!file.startsWith('integra_') || !file.endsWith('.sql.gz')) continue;
    const full = path.join(BACKUP_DIR, file);
    const ageMs = Date.now() - fs.statSync(full).mtimeMs;
    if (ageMs > 30 * 24 * 60 * 60 * 1000) {
      fs.unlinkSync(full);
    }
  }

  console.log('[backup] Done.');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
