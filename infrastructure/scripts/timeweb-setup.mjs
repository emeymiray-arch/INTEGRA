#!/usr/bin/env node
/**
 * Собирает DATABASE_URL для Timeweb, проверяет связь, поднимает схему Prisma.
 * Опционально копирует данные с Neon, если задан NEON_DATABASE_URL.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(ROOT, 'infrastructure', 'timeweb.env');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) {
    console.error(`Нет файла ${file}`);
    console.error('Скопируйте infrastructure/timeweb.env.example → infrastructure/timeweb.env и заполните.');
    process.exit(1);
  }
  const parsed = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    parsed[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return parsed;
}

function buildUrl({ host, port, user, password, database }) {
  if (!host || !user || !password || !database) {
    console.error('Заполните TIMEWEB_HOST, TIMEWEB_USER, TIMEWEB_PASSWORD, TIMEWEB_DATABASE в timeweb.env');
    process.exit(1);
  }
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  return `postgresql://${encUser}:${encPass}@${host}:${port || '5432'}/${database}?sslmode=require`;
}

async function ping(connectionString, label) {
  const { Pool } = require(path.join(ROOT, 'apps/api/node_modules/pg'));
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 8000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const result = await pool.query('select current_database() as db, current_user as user');
    console.log(`OK ${label}: база ${result.rows[0].db}, пользователь ${result.rows[0].user}`);
  } finally {
    await pool.end();
  }
}

function run(cmd, args, extraEnv) {
  const result = spawnSync(cmd, args, {
    cwd: path.join(ROOT, 'apps/api'),
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const env = loadEnvFile(ENV_FILE);
  const timewebUrl = buildUrl({
    host: env.TIMEWEB_HOST,
    port: env.TIMEWEB_PORT,
    user: env.TIMEWEB_USER,
    password: env.TIMEWEB_PASSWORD,
    database: env.TIMEWEB_DATABASE,
  });

  console.log('1) Проверяю Timeweb…');
  await ping(timewebUrl, 'Timeweb');

  if (env.NEON_DATABASE_URL) {
    console.log('2) Проверяю Neon и копирую данные…');
    await ping(env.NEON_DATABASE_URL, 'Neon');
    const dumpFile = path.join(ROOT, 'infrastructure', 'integra-neon.dump.sql');
    const dump = spawnSync(
      'pg_dump',
      ['--no-owner', '--no-acl', '--clean', '--if-exists', env.NEON_DATABASE_URL],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 200 },
    );
    if (dump.status !== 0) {
      console.error(dump.stderr || 'pg_dump не найден. Установите PostgreSQL client tools.');
      process.exit(1);
    }
    fs.writeFileSync(dumpFile, dump.stdout);
    const restore = spawnSync('psql', [timewebUrl, '-v', 'ON_ERROR_STOP=1', '-f', dumpFile], {
      stdio: 'inherit',
    });
    if (restore.status !== 0) process.exit(restore.status ?? 1);
    console.log('Данные скопированы с Neon → Timeweb');
  } else {
    console.log('2) Пустая база — накатываю схему Prisma…');
    run('npx', ['prisma', 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate'], {
      DATABASE_URL: timewebUrl,
    });
  }

  const outFile = path.join(ROOT, 'infrastructure', 'DATABASE_URL.timeweb.txt');
  fs.writeFileSync(outFile, `${timewebUrl}\n`);
  console.log('');
  console.log('Готово. Строка для Vercel сохранена в infrastructure/DATABASE_URL.timeweb.txt');
  console.log('(файл в git не коммитьте)');
  console.log('');
  console.log('Дальше:');
  console.log('1. Vercel → Project → Settings → Environment Variables');
  console.log('2. DATABASE_URL = содержимое DATABASE_URL.timeweb.txt');
  console.log('3. Environment: Production (и Preview, если нужно)');
  console.log('4. Deployments → три точки на последнем → Redeploy');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
