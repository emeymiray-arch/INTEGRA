# Подключение Timeweb PostgreSQL к INTEGRA

Сайт остаётся на Vercel. Меняется только база. Код трогать не нужно.

## 1. Что купить в Timeweb

Откройте [Timeweb Cloud → PostgreSQL](https://timeweb.cloud/services/postgresql), не обычный «хостинг сайта».

- Тип: **PostgreSQL 16**
- Регион: Москва или Санкт-Петербург
- Минимальный тариф, **без реплик**
- Срок: 6 или 12 месяцев
- **Публичный IP — включить** (иначе Vercel не подключится)
- TLS / защищённое подключение — включено

## 2. Что выписать из панели

Вкладка **Подключение**:

- хост (или IP)
- порт (обычно `5432`)
- имя базы
- пользователь
- пароль

## 3. Заполнить файл

В проекте:

```bash
cp infrastructure/timeweb.env.example infrastructure/timeweb.env
```

Вставить пять полей. Если на Neon уже есть живые пациенты — добавьте `NEON_DATABASE_URL=...` (старая строка из Vercel). Если база пустая — эту строку не трогайте.

## 4. Одна команда

Из корня репозитория:

```bash
node infrastructure/scripts/timeweb-setup.mjs
```

Скрипт проверит связь, создаст таблицы (или перенесёт данные с Neon) и запишет готовую строку в `infrastructure/DATABASE_URL.timeweb.txt`.

Нужны `node`, доступ в интернет и, для переноса с Neon, утилиты `pg_dump` / `psql`.

## 5. Вставить в Vercel

1. Vercel → проект INTEGRA → **Settings → Environment Variables**
2. `DATABASE_URL` = одна строка из `DATABASE_URL.timeweb.txt`
3. Production (обязательно)
4. **Deployments → Redeploy** последнего деплоя

Сайт начнёт ходить в Timeweb. Neon можно не удалять сразу — как запас на неделю.

## Если команда ругается

- `Нет файла timeweb.env` — шаг 3 не сделан
- timeout / connect — нет публичного IP или неверный хост
- password authentication failed — опечатка в пароле, не забудьте скопировать целиком
- `pg_dump не найден` — для переноса данных поставьте PostgreSQL client, либо оставьте Neon-строку пустой и накатите пустую схему
