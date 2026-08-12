# INTEGRA CRM

Коммерческая CRM для медицинского центра (остеопатия, мануальная терапия, массаж, реабилитация).

## Стек

| Слой | Технологии |
|------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand, Framer Motion |
| Backend | NestJS, Prisma, PostgreSQL, JWT |
| Monorepo | pnpm + Turborepo |
| Storage | StorageProvider (Local / Google Drive / S3) |

## Быстрый старт

```bash
# 1. Зависимости
pnpm install

# 2. База данных
docker compose -f infrastructure/docker/docker-compose.yml up -d
cp .env.example apps/api/.env

# 3. Миграция и seed
pnpm db:push
pnpm db:seed

# 4. Запуск
pnpm dev
```

- **Web:** http://localhost:5173
- **API:** http://localhost:3000/api/v1
- **Swagger:** http://localhost:3000/api/docs

### Учётные данные (seed)

| Email | Пароль | Роль |
|-------|--------|------|
| admin@integra.ru | admin123 | Admin |

## Структура

```
integra/
├── apps/api/          # NestJS backend
├── apps/web/          # React frontend
├── packages/shared/   # Типы, enums, Zod, permissions
├── packages/ui/       # Design system
├── docs/              # Архитектура
└── infrastructure/    # Docker, backup scripts
```

## Скрипты

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Запуск API + Web |
| `pnpm build` | Сборка всех пакетов |
| `pnpm db:push` | Применить Prisma schema |
| `pnpm db:seed` | Начальные данные INTEGRA |
| `pnpm db:studio` | Prisma Studio |

## Деплой на Vercel (frontend)

Рекомендуемые настройки проекта:

1. **Root Directory:** `.` (корень репозитория) — предпочтительно
   - или `apps/web`
2. **Framework Preset:** Other
3. Build/Output берутся из `vercel.json`

Сборка идёт через `infrastructure/scripts/vercel-build-web.sh` и публикует статику в `dist`.

NestJS API (`@integra/api`) на Vercel как SPA не деплоится — нужен отдельный хостинг (Railway / Render / Fly). Для API в build всегда выполняется `prisma generate`.

## Документация

- [Архитектура v2.0](docs/ARCHITECTURE.md)
- [Design System](docs/DESIGN-SYSTEM.md)
