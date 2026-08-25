# Google Drive — файлы и восстановление данных

INTEGRA кладёт в Drive:

1. **Фото и документы** пациентов (если включён `STORAGE_PROVIDER=google_drive`).
2. **Ежедневные бэкапы PostgreSQL** (скрипт + GitHub Action).

Вход — **Service Account** (один JSON-ключ), без входа врача в Google.

## 1. Google Cloud

1. Создайте проект в [Google Cloud Console](https://console.cloud.google.com/).
2. Включите **Google Drive API**.
3. **IAM → Service Accounts → Create**.
4. Создайте ключ **JSON** и скачайте файл.
5. В Google Drive создайте папку, например `INTEGRA`.
6. Откройте «Доступ» к папке и добавьте **email** service account из JSON (`client_email`) с правом **Редактор**.
7. Скопируйте **ID папки** из URL: `https://drive.google.com/drive/folders/ЭТОТ_ID`.

## 2. Переменные окружения

### Vercel (Production) — файлы в CRM

| Variable | Значение |
|----------|----------|
| `STORAGE_PROVIDER` | `google_drive` |
| `GOOGLE_DRIVE_FOLDER_ID` | ID папки |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` | весь JSON ключа **одной строкой** (или base64 от этого JSON) |

Если ключ или папка не заданы, API **не падает**: пишет файлы локально / в checksum, как раньше.

### GitHub Secrets — бэкапы БД

В репозитории: **Settings → Secrets and variables → Actions**:

| Secret | Значение |
|--------|----------|
| `DATABASE_URL` | та же строка PostgreSQL, что на Vercel |
| `GOOGLE_DRIVE_FOLDER_ID` | тот же ID папки |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` | тот же JSON ключа |

Workflow [`.github/workflows/backup-gdrive.yml`](../.github/workflows/backup-gdrive.yml) гоняет бэкап **каждый день в 02:15 UTC** и вручную через **Actions → Database backup to Google Drive → Run workflow**.

Структура в Drive:

```
INTEGRA/                          ← ваша общая папка
  {organizationId}/
    Patient/
      {uuid}_photo.jpg
  backups/
    2026-08-25/
      integra_2026-08-25T02-15-00.sql.gz
```

## 3. Ручной бэкап

Нужны `node`, `pnpm`, `pg_dump` и env выше:

```bash
pnpm db:backup
```

Локальная копия dump также сохраняется в `./backups/` (папка в `.gitignore`).

## 4. Восстановление базы после сбоя

1. В Drive откройте `backups/` → последняя дата → скачайте `integra_*.sql.gz`.
2. Распакуйте:

```bash
gunzip -k integra_YYYY-MM-DD....sql.gz
```

3. Восстановите в PostgreSQL (Timeweb / новая база):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f integra_YYYY-MM-DD....sql
```

4. На Vercel проверьте `DATABASE_URL` и сделайте Redeploy при необходимости.
5. Фото, загруженные уже в Drive, остаются в папке по organization / Patient; записи в таблице `files` ссылаются на них через `external_id`.

Если dump очень большой или `psql` ругается на владельцев объектов — для чистой базы сначала накатите схему (`pnpm db:push`), затем импортируйте данные; при необходимости обратитесь к обычному `pg_restore` / ручной правке dump.

## 5. Проверка, что всё живо

1. В CRM загрузите фото пациента — файл должен появиться в Drive под `{orgId}/Patient/`.
2. В GitHub запустите workflow вручную — в Drive появится `backups/{сегодня}/integra_*.sql.gz`.
3. `GET /api/health` по-прежнему должен отдавать `"ok": true`.

## Что не делаем автоматически

- Перенос старых фото, уже сохранённых как data-URL в БД, в Drive.
- Кнопка «Восстановить из Drive» в интерфейсе CRM — восстановление через этот документ и `psql`.
