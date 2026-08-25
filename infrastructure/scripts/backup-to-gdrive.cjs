#!/usr/bin/env node
/**
 * Dump PostgreSQL and upload the gzip archive to Google Drive.
 *
 * Required env:
 *   DATABASE_URL
 *   GOOGLE_DRIVE_FOLDER_ID          (folder id or full Drive folder URL)
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
const { createRequire } = require('module');

// googleapis lives in apps/api (pnpm workspace); resolve from there.
const requireFromApi = createRequire(
  path.join(__dirname, '../../apps/api/package.json'),
);
const { google } = requireFromApi('googleapis');

const ROOT = path.resolve(__dirname, '../..');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(ROOT, 'backups');

function fail(message) {
  console.error(`[backup] ${message}`);
  process.exit(1);
}

function normalizeFolderId(raw) {
  const value = (raw || '').trim();
  if (!value) return '';
  const fromUrl = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  const fromQuery = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  return value.replace(/["']/g, '');
}

function parseServiceAccountJson(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const attempts = [trimmed];
  try {
    attempts.push(Buffer.from(trimmed, 'base64').toString('utf8'));
  } catch {
    // ignore
  }
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed.private_key && typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      if (parsed.client_email && parsed.private_key) return parsed;
    } catch {
      // try next
    }
  }
  return null;
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

function resolvePgDumpBin() {
  const candidates = [
    '/usr/lib/postgresql/18/bin/pg_dump',
    '/usr/lib/postgresql/17/bin/pg_dump',
    '/usr/lib/postgresql/16/bin/pg_dump',
    'pg_dump',
  ];
  for (const bin of candidates) {
    if (bin === 'pg_dump') return bin;
    if (fs.existsSync(bin)) return bin;
  }
  return 'pg_dump';
}

function dumpDatabase(databaseUrl, dumpPath) {
  const pgDumpBin = resolvePgDumpBin();
  console.log(`[backup] Using ${pgDumpBin}`);
  // Prefer direct argv to avoid shell quoting issues with special chars in URL.
  const pgDump = spawnSync(
    pgDumpBin,
    [
      databaseUrl,
      '--no-owner',
      '--no-acl',
      '--format=plain',
    ],
    {
      encoding: 'buffer',
      maxBuffer: 512 * 1024 * 1024,
      env: {
        ...process.env,
        PGSSLMODE: process.env.PGSSLMODE || 'require',
      },
    },
  );

  if (pgDump.error) {
    fail(`pg_dump could not start: ${pgDump.error.message}`);
  }
  if (pgDump.status !== 0) {
    const errText = (pgDump.stderr || Buffer.alloc(0)).toString('utf8').trim();
    fail(
      `pg_dump failed (exit ${pgDump.status}). ${errText || 'Check DATABASE_URL and that the DB is awake.'}`,
    );
  }

  const gzip = spawnSync('gzip', ['-c'], {
    input: pgDump.stdout,
    encoding: 'buffer',
    maxBuffer: 512 * 1024 * 1024,
  });
  if (gzip.status !== 0) {
    fail(`gzip failed: ${(gzip.stderr || Buffer.alloc(0)).toString('utf8')}`);
  }
  fs.writeFileSync(dumpPath, gzip.stdout);
}

async function main() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  const folderId = normalizeFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);
  const credentials = parseServiceAccountJson(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);

  if (!databaseUrl) fail('DATABASE_URL is missing in GitHub Secrets');
  if (!folderId) fail('GOOGLE_DRIVE_FOLDER_ID is missing or empty');
  if (!credentials?.client_email || !credentials?.private_key) {
    fail(
      'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is missing or not valid JSON (need client_email + private_key)',
    );
  }

  console.log(`[backup] Service account: ${credentials.client_email}`);
  console.log(`[backup] Folder id: ${folderId}`);
  console.log(`[backup] DB host: ${(() => {
    try {
      return new URL(databaseUrl).host;
    } catch {
      return '(unparsed)';
    }
  })()}`);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dateFolder = stamp.slice(0, 10);
  const dumpName = `integra_${stamp}.sql.gz`;
  const dumpPath = path.join(BACKUP_DIR, dumpName);

  console.log(`[backup] Dumping database to ${dumpPath}`);
  dumpDatabase(databaseUrl, dumpPath);

  const buffer = fs.readFileSync(dumpPath);
  if (buffer.length < 50) {
    fail('Dump file is empty — database dump likely failed');
  }
  console.log(`[backup] Dump size ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  // Full drive scope: needed so SA can write into a folder shared with it.
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  try {
    await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fail(
      `Cannot open Drive folder ${folderId}. Share the folder with ${credentials.client_email} as Editor. Details: ${msg}`,
    );
  }

  console.log('[backup] Creating backups/ date folders if needed');
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
  fail(error instanceof Error ? error.stack || error.message : String(error));
});
