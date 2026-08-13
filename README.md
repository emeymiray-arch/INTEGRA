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

## Деплой на Vercel (web + API в одном проекте)

Root Directory: **`.`** (корень репозитория)

### Обязательные Environment Variables

| Variable | Значение |
|----------|----------|
| `DATABASE_URL` | PostgreSQL (Neon). Без неё API вернёт 503 |
| `JWT_ACCESS_SECRET` | длинный секрет |
| `JWT_REFRESH_SECRET` | длинный секрет |
| `CORS_ORIGIN` | `*` или URL фронта |

После добавления `DATABASE_URL` один раз примените схему:

```bash
cd apps/api && npx prisma db push && npx prisma db seed
```

(или через Neon SQL / CI).

Фронт ходит на тот же домен: `/api/v1/...`

## Документация

- [Архитектура v2.0](docs/ARCHITECTURE.md)
- [Design System](docs/DESIGN-SYSTEM.md)
