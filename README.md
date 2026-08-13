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

## Деплой

### Почему «не удалось зарегистрироваться» на Vercel

Сейчас проект `integra-api` отдаёт **только фронт (SPA)**.  
Запрос `POST /api/v1/auth/register` уходит в никуда → ошибка регистрации.

Нужно **два сервиса**:

1. **Web** (Vercel) — UI  
2. **API** (NestJS) + **PostgreSQL** (Neon / Supabase / Railway)

### Локально (работает сразу)

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
cp .env.example apps/api/.env
pnpm db:push && pnpm db:seed
pnpm dev
```

Откройте http://localhost:5173/register

### Production

1. Создайте PostgreSQL (Neon) → `DATABASE_URL`
2. Задеплойте API (`apps/api`) с env:
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CORS_ORIGIN=https://ваш-фронт.vercel.app`
3. Во фронт-проекте Vercel добавьте:
   - `VITE_API_URL=https://ваш-api.vercel.app/api/v1`
4. Redeploy фронта

## Документация

- [Архитектура v2.0](docs/ARCHITECTURE.md)
- [Design System](docs/DESIGN-SYSTEM.md)
