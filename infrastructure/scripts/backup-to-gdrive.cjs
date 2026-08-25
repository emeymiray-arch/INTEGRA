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
  let value = (raw || '').trim();
  // Secrets pasted from browsers/Docs sometimes include BOM / zero-width chars.
  value = value.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!value) return '';
  const fromUrl = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  const fromQuery = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  value = value.replace(/["'\s]/g, '');
  const onlyId = value.match(/^[a-zA-Z0-9_-]+$/);
  return onlyId ? onlyId[0] : value;
}

async function listSharedFolders(drive) {
  const shared = await drive.files.list({
    q: "sharedWithMe = true and trashed = false and mimeType = 'application/vnd.google-apps.folder'",
    fields: 'files(id, name)',
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return shared.data.files || [];
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
        let key = parsed.private_key;
        // GitHub/Vercel pastes often flatten or double-escape newlines.
        key = key.replace(/\\n/g, '\n');
        key = key.replace(/\r\n/g, '\n');
        if (!key.includes('\n') && key.includes('-----BEGIN')) {
          key = key
            .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
            .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----\n')
            .replace(/-----BEGIN PRIVATE KEY-----\n([\s\S]+)\n-----END PRIVATE KEY-----/, (_, body) => {
              const compact = body.replace(/\s+/g, '');
              const lines = compact.match(/.{1,64}/g) || [];
              return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
            });
        }
        parsed.private_key = key;
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

  // Confirm auth works before blaming the folder id.
  try {
    const about = await drive.about.get({ fields: 'user(emailAddress,displayName)' });
    console.log(
      `[backup] Drive auth OK as ${about.data.user?.emailAddress || credentials.client_email}`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fail(`Drive auth failed before opening folder. Details: ${msg}`);
  }

  console.log(
    `[backup] Folder id length=${folderId.length} prefix=${folderId.slice(0, 4)}…`,
  );
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(folderId)) {
    fail(
      `GOOGLE_DRIVE_FOLDER_ID looks invalid (${folderId.length} chars). ` +
        `Put only the id from …/folders/THIS_PART (or the full folder URL).`,
    );
  }

  let rootFolderId = folderId;

  try {
    const meta = await drive.files.get({
      fileId: rootFolderId,
      fields: 'id, name, mimeType, driveId, shortcutDetails',
      supportsAllDrives: true,
    });
    console.log(
      `[backup] Opened Drive item "${meta.data.name}" (${meta.data.mimeType})`,
    );
    if (meta.data.mimeType === 'application/vnd.google-apps.shortcut') {
      const target = meta.data.shortcutDetails?.targetId;
      fail(
        `GOOGLE_DRIVE_FOLDER_ID points to a shortcut, not a folder. ` +
          `Open the real folder and copy its URL id` +
          (target ? ` (shortcut target id=${target})` : '') +
          '.',
      );
    }
    if (meta.data.mimeType !== 'application/vnd.google-apps.folder') {
      fail(
        `GOOGLE_DRIVE_FOLDER_ID is a file (${meta.data.mimeType}), not a folder.`,
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    let folders = [];
    try {
      folders = await listSharedFolders(drive);
    } catch {
      // ignore listing errors; keep original failure
    }
    const visible = folders.map((f) => `${f.name}=${f.id}`);
    const matched = folders.find((f) => f.id === folderId);
    const byName = folders.find(
      (f) => (f.name || '').toLowerCase() === 'integra',
    );

    if (matched?.id) {
      console.log(
        `[backup] files.get failed (${msg}), but folder is in sharedWithMe — continuing with ${matched.name}`,
      );
      rootFolderId = matched.id;
    } else if (byName?.id) {
      console.log(
        `[backup] Configured id not visible (${msg}). Falling back to shared folder "${byName.name}" (${byName.id})`,
      );
      rootFolderId = byName.id;
    } else if (folders.length === 1 && folders[0].id) {
      console.log(
        `[backup] Configured id not visible (${msg}). Falling back to only shared folder "${folders[0].name}" (${folders[0].id})`,
      );
      rootFolderId = folders[0].id;
    } else {
      const hint =
        visible.length > 0
          ? `Folders visible to the service account: ${visible.join(' | ')}. ` +
            `Put one of these ids into GOOGLE_DRIVE_FOLDER_ID.`
          : `Service account sees ZERO shared folders. In Drive → folder → Share, add exactly ` +
            `${credentials.client_email} as Editor (uncheck Notify). ` +
            `If sharing is blocked by Google Workspace, create a Shared drive, add the SA as Content manager, use that folder id.`;
      fail(
        `Cannot open Drive folder (id length ${folderId.length}). Details: ${msg}. ${hint}`,
      );
    }
  }

  console.log('[backup] Creating backups/ date folders if needed');
  const backupsId = await ensureChildFolder(drive, rootFolderId, 'backups');
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
