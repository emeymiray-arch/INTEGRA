# INTEGRA — Архитектура CRM медицинского центра

> Версия: **2.0** · Статус: **реализовано** · Дата: 2026-07-13

## Changelog v2.0

| Изменение | Описание |
|-----------|----------|
| Multi-role RBAC | `User → Staff → StaffRole → Role` — несколько ролей на сотрудника |
| Multi-tenant | Добавлен `Organization` как корневой tenant над `Branch` |
| Patient | Расширена доменная модель (аллергии, противопоказания, экстренный контакт) |
| Medical domain | Разделение на `Visit`, `Diagnosis`, `TreatmentPlan`, `Recommendation`, `Measurement`, `Attachment` |
| Files | Универсальная полиморфная сущность `File` вместо `PatientDocument` |
| Activity | Отдельный `ActivityLog` для действий пользователей |
| Appointments | Новые статусы + `AppointmentStatusHistory` |
| Finance | `Invoice`, `InvoiceItem`, `Payment`, `Refund`, `PaymentMethod` |
| Notifications | Абстракция `NotificationProvider` (Strategy) |
| Audit | Пофилдовый `AuditLog` |

---

## 1. Видение продукта

**INTEGRA** — коммерческая CRM для сети медицинских центров (остеопатия, мануальная терапия, массаж, реабилитация). Система проектируется как **multi-tenant** монорепозиторий: одна инсталляция обслуживает несколько организаций, каждая — несколько филиалов.

### Иерархия tenant

```
Organization (tenant)
  └── Branch (филиал)
        └── Staff, Patients, Services, Appointments, ...
```

### Ключевые принципы

| Принцип | Реализация |
|---------|------------|
| Clean Architecture | Domain → Application → Infrastructure → Presentation |
| SOLID / DRY / KISS | Модули по bounded context, shared только для контрактов |
| Feature-based | Фронт и бэк организованы по фичам |
| Multi-tenant | `organization_id` на всех бизнес-сущностях |
| Масштабирование | UUID, soft-delete, audit + activity, storage/notification abstractions |
| Безопасность | JWT + refresh rotation, RBAC через union ролей, валидация на всех слоях |

---

## 2. Monorepo — структура репозитория

```
integra/
├── apps/
│   ├── api/                              # NestJS backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── users/
│   │       │   ├── organizations/
│   │       │   ├── branches/
│   │       │   ├── staff/
│   │       │   ├── patients/
│   │       │   ├── medical-records/
│   │       │   ├── appointments/
│   │       │   ├── schedule/
│   │       │   ├── services/
│   │       │   ├── finance/
│   │       │   ├── files/
│   │       │   ├── analytics/
│   │       │   ├── search/
│   │       │   ├── notifications/
│   │       │   ├── audit/
│   │       │   ├── activity/
│   │       │   ├── settings/
│   │       │   └── storage/
│   │       ├── common/
│   │       ├── config/
│   │       ├── database/
│   │       └── events/
│   └── web/                              # React 19 + Vite frontend
│       └── src/
│           ├── app/
│           ├── features/
│           │   ├── auth/
│           │   ├── dashboard/
│           │   ├── organizations/
│           │   ├── patients/
│           │   ├── medical-records/
│           │   ├── appointments/
│           │   ├── schedule/
│           │   ├── services/
│           │   ├── finance/
│           │   ├── staff/
│           │   ├── files/
│           │   ├── search/
│           │   ├── activity/
│           │   ├── settings/
│           │   └── notifications/
│           ├── shared/
│           └── components/
├── packages/
│   ├── shared/                           # Типы, enum-ы, Zod-схемы, permissions
│   ├── ui/                               # Design system INTEGRA
│   └── eslint-config/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DESIGN-SYSTEM.md
│   └── API.md
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml            # PostgreSQL, Redis
│   │   └── Dockerfile.api
│   └── scripts/
│       ├── backup-to-gdrive.sh
│       └── seed.ts
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── .env.example
```

**Менеджер пакетов:** `pnpm` + **Turborepo**.

---

## 3. Backend — Clean Architecture (NestJS)

### 3.1 Слои каждого модуля

```
apps/api/src/modules/<feature>/
├── domain/
│   ├── entities/
│   ├── value-objects/        # Money, PhoneNumber, Discount, Age, EntityRef
│   ├── repositories/         # Порты (интерфейсы)
│   └── events/
├── application/
│   ├── use-cases/
│   ├── dto/
│   └── mappers/
├── infrastructure/
│   ├── prisma/
│   └── adapters/
└── presentation/
    ├── controllers/
    ├── guards/
    └── validators/
```

### 3.2 Модули (Bounded Contexts)

| Модуль | Ответственность |
|--------|-----------------|
| **Auth** | JWT access/refresh, rotation, logout |
| **Users** | Учётные записи (email, пароль) |
| **Organizations** | Tenant: медицинские центры / сети |
| **Branches** | Филиалы внутри организации |
| **Staff** | Сотрудники, привязка к User, multi-role |
| **Patients** | Карточка пациента, статусы, источники |
| **MedicalRecords** | MedicalRecord, Visit, Diagnosis, TreatmentPlan, Recommendation, Measurement, Attachment |
| **Files** | Универсальная полиморфная модель файлов |
| **Services** | Справочник услуг и категорий |
| **Appointments** | Записи, статусы, история изменений |
| **Schedule** | Календарь, drag-and-drop, слоты |
| **Finance** | Invoice, InvoiceItem, Payment, Refund, PaymentMethod |
| **Analytics** | Dashboard, KPI, отчёты |
| **Search** | Глобальный полнотекстовый поиск |
| **Notifications** | NotificationProvider abstraction + stubs |
| **Audit** | Пофилдовый AuditLog (изменения данных) |
| **Activity** | ActivityLog (действия пользователей) |
| **Settings** | Настройки организации, интеграции |
| **Storage** | StorageProvider: Local → Google Drive → S3 |

### 3.3 Cross-cutting

```
apps/api/src/common/
├── decorators/       # @CurrentUser, @RequirePermissions, @OrganizationId, @BranchId
├── filters/
├── interceptors/     # TenantScopeInterceptor — автофильтр organization_id
├── pipes/
└── guards/           # JwtAuthGuard, PermissionsGuard
```

**Tenant isolation:** каждый запрос содержит `organization_id` из JWT. `TenantScopeInterceptor` добавляет `WHERE organization_id = :orgId` на уровне репозиториев. Суперадмин платформы (future) — `organization_id = null`.

---

## 4. Frontend — Feature-based (React 19)

Структура зеркалит backend-модули. Ключевые паттерны без изменений:

- **Server state:** TanStack Query
- **Forms:** React Hook Form + Zod (`@integra/shared`)
- **UI state:** Zustand
- **Анимации:** Framer Motion
- **Design system:** `@integra/ui`

---

## 5. Доменная модель — обзор связей

```mermaid
flowchart TB
    subgraph identity [Identity & Access]
        User --> Staff
        Staff --> StaffRole
        StaffRole --> Role
        Role --> RolePermission
        RolePermission --> Permission
    end

    subgraph tenant [Tenant]
        Organization --> Branch
        Organization --> Staff
        Organization --> Patient
        Organization --> Service
    end

    subgraph clinical [Clinical]
        Patient --> MedicalRecord
        MedicalRecord --> Visit
        Visit --> Diagnosis
        Visit --> Recommendation
        Visit --> Measurement
        Visit --> Attachment
        MedicalRecord --> TreatmentPlan
        Attachment -.-> File
    end

    subgraph scheduling [Scheduling]
        Appointment --> Visit
        Appointment --> AppointmentStatusHistory
        Appointment --> Invoice
    end

    subgraph finance [Finance]
        Invoice --> InvoiceItem
        Invoice --> Payment
        Payment --> Refund
        Payment --> PaymentMethod
    end

    subgraph platform [Platform Services]
        File
        AuditLog
        ActivityLog
        NotificationLog
    end

    Branch --> Appointment
    Staff --> Appointment
    Patient --> Appointment
    Service --> Appointment
```

---

## 6. ER-диаграмма базы данных

### 6.1 Общая диаграмма

```mermaid
erDiagram
    Organization ||--o{ Branch : has
    Organization ||--o{ Staff : employs
    Organization ||--o{ Patient : manages
    Organization ||--o{ Service : offers
    Organization ||--o{ ServiceCategory : groups
    Organization ||--o{ PaymentMethod : configures
    Organization ||--o{ File : stores

    Branch ||--o{ Staff : assigns
    Branch ||--o{ Appointment : hosts
    Branch ||--o{ Patient : "preferred_by"

    User ||--|| Staff : "is"
    Staff ||--o{ StaffRole : has
    Role ||--o{ StaffRole : assigned_via
    Role ||--o{ RolePermission : grants
    Permission ||--o{ RolePermission : included_in

    Patient ||--|| MedicalRecord : owns
    Patient ||--o{ Appointment : books
    Patient ||--o{ Invoice : billed

    MedicalRecord ||--o{ Visit : contains
    MedicalRecord ||--o{ TreatmentPlan : plans

    Visit ||--o{ Diagnosis : records
    Visit ||--o{ Recommendation : gives
    Visit ||--o{ Measurement : tracks
    Visit ||--o{ Attachment : has
    Visit }o--o| Appointment : "linked_to"

    Appointment ||--o{ AppointmentStatusHistory : tracks
    Appointment ||--o| Invoice : generates

    Invoice ||--o{ InvoiceItem : contains
    Invoice ||--o{ Payment : receives
    Payment ||--o{ Refund : reversed_by
    PaymentMethod ||--o{ Payment : used_in

    Staff ||--o{ Visit : conducts
    Staff ||--o{ Appointment : performs
    Service ||--o{ Appointment : booked
    Service ||--o{ InvoiceItem : itemized

    File }o--|| Staff : "created_by"
    Attachment }o--|| File : references

    User ||--o{ AuditLog : changes
    User ||--o{ ActivityLog : acts
    User ||--o{ RefreshToken : owns
```

### 6.2 Identity & Tenant

```mermaid
erDiagram
    Organization {
        uuid id PK
        string name
        string slug UK
        string legal_name
        string tax_id
        string phone
        string email
        string logo_url
        jsonb settings
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    Branch {
        uuid id PK
        uuid organization_id FK
        string name
        string address
        string phone
        string email
        string timezone
        jsonb working_hours
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    User {
        uuid id PK
        string email UK
        string password_hash
        boolean is_active
        timestamp last_login_at
        timestamp created_at
    }

    Staff {
        uuid id PK
        uuid user_id FK UK
        uuid organization_id FK
        uuid branch_id FK
        string first_name
        string last_name
        string middle_name
        string specialization
        string phone
        string avatar_url
        jsonb working_hours
        boolean is_active
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    Role {
        uuid id PK
        string code UK
        string name
        string description
        boolean is_system
    }

    StaffRole {
        uuid id PK
        uuid staff_id FK
        uuid role_id FK
        uuid assigned_by FK
        timestamp assigned_at
        timestamp revoked_at
    }

    Permission {
        uuid id PK
        string code UK
        string resource
        string action
        string description
    }

    RolePermission {
        uuid role_id FK
        uuid permission_id FK
    }
```

**Роли (system):** `ADMIN`, `DOCTOR`, `MASSAGE_THERAPIST`, `MANAGER`, `FINANCE`

**Примеры комбинаций:**
- Doctor + Admin
- Massage Therapist + Manager
- Administrator + Finance

### 6.3 Patient & Clinical

```mermaid
erDiagram
    Patient {
        uuid id PK
        uuid organization_id FK
        uuid preferred_branch_id FK
        uuid primary_staff_id FK
        string first_name
        string last_name
        string middle_name
        date birth_date
        enum gender "MALE|FEMALE|OTHER"
        string phone
        string email
        string address
        jsonb emergency_contact
        text allergies
        text contraindications
        text chronic_diseases
        text notes
        enum source "REFERRAL|WEBSITE|SOCIAL|WALK_IN|ADVERTISING|OTHER"
        enum status "ACTIVE|INACTIVE|COMPLETED|ARCHIVED"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    MedicalRecord {
        uuid id PK
        uuid organization_id FK
        uuid patient_id FK UK
        text summary
        timestamp opened_at
        timestamp updated_at
        uuid updated_by FK
    }

    Visit {
        uuid id PK
        uuid organization_id FK
        uuid medical_record_id FK
        uuid appointment_id FK
        uuid staff_id FK
        uuid branch_id FK
        timestamp visited_at
        text chief_complaint
        text anamnesis
        text clinical_notes
        text prescriptions
        enum status "PLANNED|IN_PROGRESS|COMPLETED|CANCELLED"
        timestamp created_at
        uuid created_by FK
    }

    Diagnosis {
        uuid id PK
        uuid visit_id FK
        string icd_code
        string title
        text description
        boolean is_primary
        timestamp created_at
        uuid created_by FK
    }

    TreatmentPlan {
        uuid id PK
        uuid organization_id FK
        uuid medical_record_id FK
        uuid staff_id FK
        string title
        text description
        date start_date
        date end_date
        enum status "DRAFT|ACTIVE|COMPLETED|CANCELLED"
        timestamp created_at
        uuid created_by FK
    }

    Recommendation {
        uuid id PK
        uuid visit_id FK
        text content
        date follow_up_date
        timestamp created_at
        uuid created_by FK
    }

    Measurement {
        uuid id PK
        uuid visit_id FK
        string type
        string unit
        decimal value
        text notes
        timestamp measured_at
        uuid measured_by FK
    }

    Attachment {
        uuid id PK
        uuid visit_id FK
        uuid medical_record_id FK
        uuid file_id FK UK
        enum document_type "PHOTO|MRI|CT|XRAY|LAB|PDF|DOC|OTHER"
        string title
        text description
        timestamp created_at
    }
```

**Возраст пациента:** вычисляется в application layer (`Age.fromBirthDate(birthDate)`), **не хранится** в БД.

**`emergency_contact` (jsonb):**
```json
{ "name": "...", "phone": "...", "relation": "..." }
```

### 6.4 Appointments & Schedule

```mermaid
erDiagram
    Appointment {
        uuid id PK
        uuid organization_id FK
        uuid branch_id FK
        uuid patient_id FK
        uuid staff_id FK
        uuid service_id FK
        timestamp starts_at
        timestamp ends_at
        int duration_minutes
        decimal base_price
        enum discount_type "NONE|PERCENT|FIXED"
        decimal discount_value
        decimal discount_amount
        decimal final_price
        enum status "CREATED|CONFIRMED|ARRIVED|IN_PROGRESS|COMPLETED|CANCELLED|NO_SHOW|RESCHEDULED"
        text notes
        timestamp created_at
        uuid created_by FK
        timestamp updated_at
        timestamp deleted_at
    }

    AppointmentStatusHistory {
        uuid id PK
        uuid appointment_id FK
        enum from_status
        enum to_status
        text reason
        jsonb metadata
        timestamp changed_at
        uuid changed_by FK
    }
```

**Статусы записи:**

| Статус | Описание |
|--------|----------|
| `CREATED` | Запись создана |
| `CONFIRMED` | Подтверждена пациентом/админом |
| `ARRIVED` | Пациент пришёл |
| `IN_PROGRESS` | Приём идёт |
| `COMPLETED` | Завершён |
| `CANCELLED` | Отменён |
| `NO_SHOW` | Не явился |
| `RESCHEDULED` | Перенесён (создаётся новая запись, metadata хранит old/new time) |

Каждое изменение статуса → запись в `AppointmentStatusHistory` + `ActivityLog`.

### 6.5 Finance

```mermaid
erDiagram
    Invoice {
        uuid id PK
        uuid organization_id FK
        uuid branch_id FK
        uuid patient_id FK
        uuid appointment_id FK
        string number UK
        enum status "DRAFT|ISSUED|PARTIAL|PAID|CANCELLED|REFUNDED"
        decimal subtotal
        decimal discount_amount
        decimal total_amount
        decimal paid_amount
        decimal balance
        text notes
        timestamp issued_at
        timestamp created_at
        uuid created_by FK
    }

    InvoiceItem {
        uuid id PK
        uuid invoice_id FK
        uuid service_id FK
        string description
        int quantity
        decimal unit_price
        enum discount_type "NONE|PERCENT|FIXED"
        decimal discount_value
        decimal discount_amount
        decimal total_price
    }

    PaymentMethod {
        uuid id PK
        uuid organization_id FK
        string code UK
        string name
        enum type "CASH|CARD|TRANSFER|CERTIFICATE|DEPOSIT|SUBSCRIPTION|OTHER"
        boolean is_active
        jsonb config
    }

    Payment {
        uuid id PK
        uuid organization_id FK
        uuid invoice_id FK
        uuid payment_method_id FK
        decimal amount
        string reference
        text notes
        timestamp paid_at
        uuid received_by FK
        timestamp created_at
    }

    Refund {
        uuid id PK
        uuid organization_id FK
        uuid payment_id FK
        decimal amount
        text reason
        timestamp refunded_at
        uuid refunded_by FK
        timestamp created_at
    }
```

**Задел на будущее без смены архитектуры:**
- Частичные оплаты → несколько `Payment` на один `Invoice`, `balance` пересчитывается
- Абонементы / сертификаты → `PaymentMethod.type = SUBSCRIPTION | CERTIFICATE`
- Депозиты → `PaymentMethod.type = DEPOSIT` + отдельный wallet-контекст (future module)

### 6.6 Files (универсальная модель)

```mermaid
erDiagram
    File {
        uuid id PK
        uuid organization_id FK
        string entity_type
        uuid entity_id
        string filename
        string mime_type
        bigint size
        enum storage_provider "LOCAL|GOOGLE_DRIVE|S3"
        string storage_key
        string external_id
        string checksum
        uuid created_by FK
        timestamp created_at
        timestamp deleted_at
    }
```

**Полиморфная привязка (`entity_type` + `entity_id`):**

| entity_type | Примеры |
|-------------|---------|
| `Patient` | Фото, документы пациента |
| `MedicalRecord` | Общие мед. документы |
| `Visit` | Документы конкретного визита |
| `Appointment` | Согласия, акты |
| `Staff` | Аватар, сертификаты |
| `Organization` | Логотип, лицензии |
| `Branch` | Документы филиала |

`Attachment` в клиническом контексте ссылается на `File` и добавляет медицинские метаданные (`document_type`, `title`).

**Индекс:** `UNIQUE (entity_type, entity_id, storage_key)` + `INDEX (entity_type, entity_id)`.

### 6.7 Audit & Activity

```mermaid
erDiagram
    AuditLog {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string entity_type
        uuid entity_id
        string field_name
        text old_value
        text new_value
        enum action "CREATE|UPDATE|DELETE"
        string ip_address
        timestamp created_at
    }

    ActivityLog {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string event_type
        string entity_type
        uuid entity_id
        jsonb metadata
        string ip_address
        timestamp created_at
    }
```

**Разделение ответственности:**

| Лог | Что фиксирует | Пример |
|-----|---------------|--------|
| **AuditLog** | Изменение данных (пофилдово) | `Patient.phone`: `+7999...` → `+7888...` |
| **ActivityLog** | Действие пользователя (бизнес-событие) | `patient.created`, `document.uploaded`, `appointment.rescheduled` |

**Типы ActivityLog (`event_type`):**

```
auth.login
auth.logout
patient.created
patient.updated
document.uploaded
document.deleted
appointment.created
appointment.rescheduled
appointment.status_changed
appointment.cancelled
payment.processed
payment.refunded
service.created
service.updated
staff.created
invoice.issued
```

### 6.8 Services & Notifications

```mermaid
erDiagram
    ServiceCategory {
        uuid id PK
        uuid organization_id FK
        string name
        string slug
        int sort_order
        boolean is_active
    }

    Service {
        uuid id PK
        uuid organization_id FK
        uuid category_id FK
        string name
        text description
        int duration_minutes
        decimal price
        boolean is_hidden
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    NotificationTemplate {
        uuid id PK
        uuid organization_id FK
        string code UK
        string channel
        string subject
        text body
        boolean is_active
    }

    NotificationLog {
        uuid id PK
        uuid organization_id FK
        uuid recipient_id
        string recipient_type
        enum channel "SMS|WHATSAPP|TELEGRAM|EMAIL|PUSH"
        string template_code
        enum status "PENDING|SENT|FAILED"
        jsonb payload
        text error_message
        timestamp scheduled_at
        timestamp sent_at
    }

    RefreshToken {
        uuid id PK
        uuid user_id FK
        string token_hash
        timestamp expires_at
        timestamp revoked_at
        string user_agent
        string ip_address
    }
```

---

## 7. Полная схема сущностей и связей

### 7.1 Таблица связей

| От | К | Тип | Описание |
|----|---|-----|----------|
| Organization | Branch | 1:N | Филиалы организации |
| Organization | Staff | 1:N | Сотрудники организации |
| Organization | Patient | 1:N | Пациенты организации |
| Organization | Service | 1:N | Услуги организации |
| Organization | ServiceCategory | 1:N | Категории услуг |
| Organization | PaymentMethod | 1:N | Способы оплаты |
| Organization | File | 1:N | Файлы организации |
| Organization | AuditLog | 1:N | Аудит |
| Organization | ActivityLog | 1:N | Активность |
| Branch | Staff | 1:N | Основной филиал сотрудника |
| Branch | Appointment | 1:N | Записи в филиале |
| Branch | Patient | 1:N | preferred_branch |
| User | Staff | 1:1 | Учётка ↔ сотрудник |
| Staff | StaffRole | 1:N | Роли сотрудника |
| Role | StaffRole | 1:N | |
| Role | RolePermission | 1:N | |
| Permission | RolePermission | 1:N | |
| Patient | MedicalRecord | 1:1 | Мед. карта |
| Patient | Appointment | 1:N | Записи |
| Patient | Invoice | 1:N | Счета |
| MedicalRecord | Visit | 1:N | Визиты |
| MedicalRecord | TreatmentPlan | 1:N | Планы лечения |
| Visit | Diagnosis | 1:N | Диагнозы визита |
| Visit | Recommendation | 1:N | Рекомендации |
| Visit | Measurement | 1:N | Измерения |
| Visit | Attachment | 1:N | Вложения |
| Visit | Appointment | N:1 | Опциональная связь с записью |
| Appointment | AppointmentStatusHistory | 1:N | История статусов |
| Appointment | Invoice | 1:1 | Счёт за приём |
| Invoice | InvoiceItem | 1:N | Позиции счёта |
| Invoice | Payment | 1:N | Оплаты (частичные) |
| Payment | Refund | 1:N | Возвраты |
| PaymentMethod | Payment | 1:N | |
| Attachment | File | 1:1 | Мед. метаданные → файл |
| Service | Appointment | 1:N | |
| Service | InvoiceItem | 1:N | |
| Staff | Visit | 1:N | Врач визита |
| Staff | Appointment | 1:N | Специалист записи |
| User | AuditLog | 1:N | |
| User | ActivityLog | 1:N | |
| User | File | 1:N | created_by |
| User | RefreshToken | 1:N | |

### 7.2 Обязательные tenant-поля

Все бизнес-сущности содержат `organization_id`. Дополнительно `branch_id` где применимо:

| Сущность | organization_id | branch_id |
|----------|:---------------:|:---------:|
| Branch | ✅ | — |
| Staff | ✅ | ✅ (primary) |
| Patient | ✅ | preferred_branch |
| Service | ✅ | — |
| Appointment | ✅ | ✅ |
| Visit | ✅ | ✅ |
| Invoice | ✅ | ✅ |
| File | ✅ | — |
| AuditLog | ✅ | — |
| ActivityLog | ✅ | — |

---

## 8. RBAC — multi-role модель

### 8.1 Цепочка доступа

```
User → Staff → StaffRole[] → Role[] → Permission[]
```

**Эффективные права** = объединение (union) permissions всех активных ролей сотрудника (`StaffRole.revoked_at IS NULL`).

```typescript
// Псевдокод проверки
function hasPermission(staff: Staff, permission: string): boolean {
  const activeRoles = staff.roles.filter(r => !r.revokedAt);
  const permissions = activeRoles.flatMap(r => r.permissions);
  return permissions.some(p => p.code === permission);
}
```

### 8.2 Матрица прав (по ролям)

| Ресурс / Действие | Admin | Doctor | Massage | Manager | Finance |
|-------------------|:-----:|:------:|:-------:|:-------:|:-------:|
| Пациенты: просмотр | ✅ | ✅ | ✅ | ✅ | ✅ |
| Пациенты: создание/редактирование | ✅ | ✅ | ✅ | ✅ | ❌ |
| Пациенты: удаление | ✅ | ❌ | ❌ | ❌ | ❌ |
| Мед. записи / визиты | ✅ | ✅ | ✅ | ❌ | ❌ |
| Файлы: загрузка | ✅ | ✅ | ✅ | ✅ | ❌ |
| Файлы: удаление | ✅ | ❌ | ❌ | ❌ | ❌ |
| Записи: управление | ✅ | ✅ свои | ✅ свои | ✅ | ❌ |
| Услуги: управление | ✅ | ❌ | ❌ | ✅ | ❌ |
| Сотрудники: управление | ✅ | ❌ | ❌ | ✅ | ❌ |
| Роли: назначение | ✅ | ❌ | ❌ | ✅ | ❌ |
| Счета / оплаты | ✅ | ❌ | ❌ | ✅ | ✅ |
| Возвраты | ✅ | ❌ | ❌ | ✅ | ✅ |
| Финансы: полные отчёты | ✅ | ❌ | ❌ | ✅ | ✅ |
| Свои доходы | ✅ | ✅ | ✅ | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ | ✅ | ❌ |
| Activity log | ✅ | ❌ | ❌ | ✅ | ❌ |
| Настройки организации | ✅ | ❌ | ❌ | ❌ | ❌ |

**Комбинированные роли:** Admin + Doctor получает union прав обеих ролей. Guard проверяет permissions, не role codes.

### 8.3 Реализация

- `@RequirePermissions('patients:read')` decorator
- `PermissionsGuard` загружает Staff + StaffRole + RolePermission при аутентификации
- Permissions кэшируются в JWT claims (short TTL) или Redis

---

## 9. StorageProvider — файловое хранилище

```typescript
interface StorageProvider {
  upload(file: Buffer, meta: UploadMeta): Promise<StorageResult>;
  download(storageKey: string): Promise<Buffer>;
  getSignedUrl(storageKey: string, ttlSeconds: number): Promise<string>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}
```

| Adapter | Среда | Назначение |
|---------|-------|------------|
| `LocalStorageAdapter` | Development | Локальная ФС |
| `GoogleDriveAdapter` | **Production (default)** | Мед. документы, бэкапы |
| `S3StorageAdapter` | Future | Масштабирование |

**Структура папок Google Drive:**
```
INTEGRA/
  {organizationId}/
    {branchId}/
      {entityType}/
        {entityId}/
          {fileId}_{filename}
  backups/
    {date}/
      integra_dump.sql.gz
```

Метаданные — в PostgreSQL (`File`), бинарники — в storage provider.

---

## 10. NotificationProvider — абстракция уведомлений

```typescript
interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(message: NotificationMessage): Promise<NotificationResult>;
  validateConfig(): Promise<boolean>;
}

interface NotificationService {
  registerProvider(provider: NotificationProvider): void;
  send(channel: NotificationChannel, message: NotificationMessage): Promise<void>;
  sendMulti(channels: NotificationChannel[], message: NotificationMessage): Promise<void>;
}
```

**Реализации (заглушки на Фазе 7):**

```
NotificationService
  ├── SmsProvider           (stub)
  ├── WhatsAppProvider      (stub)
  ├── EmailProvider         (stub)
  ├── TelegramProvider      (stub)
  └── PushProvider          (stub)
```

Паттерн **Strategy** + очередь **BullMQ**. `NotificationLog` хранит историю отправок независимо от провайдера.

**Триггеры (domain events → ActivityLog + NotificationQueue):**

| Event | Каналы (future) |
|-------|-----------------|
| `appointment.created` | SMS, WhatsApp |
| `appointment.confirmed` | SMS |
| `appointment.rescheduled` | SMS, WhatsApp |
| `appointment.reminder` (24h) | SMS, Push |
| `payment.processed` | Email |
| `patient.created` | Email |

---

## 11. Audit vs Activity — архитектурное разделение

```mermaid
sequenceDiagram
    participant UC as UseCase
    participant DS as DomainService
    participant AL as AuditLogService
    participant AC as ActivityLogService

    UC->>DS: updatePatient(id, { phone })
    DS->>AL: logFieldChange(Patient, id, "phone", old, new)
    UC->>AC: logActivity("patient.updated", { patientId })
```

| Критерий | AuditLog | ActivityLog |
|----------|----------|-------------|
| Гранулярность | Пофилдовая | Событийная |
| Аудитория | Compliance, расследования | Dashboard, лента активности |
| Запись | CREATE: все поля; UPDATE: каждое изменённое поле | Одна запись на действие |
| UI | Вкладка «История изменений» в карточке | Dashboard «Последние действия» |

**Реализация AuditLog:** Prisma middleware `$use` перехватывает `create/update/delete`, сравнивает old/new, пишет по одной строке на поле.

---

## 12. API — REST endpoints (v1)

Base URL: `/api/v1` · Все endpoints scoped by `organization_id` из JWT.

### Organizations & Branches
```
GET    /organizations/current
PATCH  /organizations/current
GET    /branches
POST   /branches
PATCH  /branches/:id
```

### Auth
```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me                      # user + staff + roles + permissions
```

### Staff
```
GET    /staff
POST   /staff
GET    /staff/:id
PATCH  /staff/:id
POST   /staff/:id/roles              # назначить роль
DELETE /staff/:id/roles/:roleId      # отозвать роль
```

### Patients
```
GET    /patients
POST   /patients
GET    /patients/:id
PATCH  /patients/:id
DELETE /patients/:id
GET    /patients/:id/audit
GET    /patients/:id/activity
```

### Medical Records
```
GET    /patients/:id/medical-record
GET    /medical-records/:id/visits
POST   /medical-records/:id/visits
GET    /visits/:id
PATCH  /visits/:id
POST   /visits/:id/diagnoses
POST   /visits/:id/recommendations
POST   /visits/:id/measurements
GET    /medical-records/:id/treatment-plans
POST   /medical-records/:id/treatment-plans
```

### Files
```
GET    /files?entityType=&entityId=
POST   /files                        # multipart, entity_type + entity_id
GET    /files/:id
GET    /files/:id/preview
DELETE /files/:id
```

### Appointments
```
GET    /appointments
POST   /appointments
GET    /appointments/:id
PATCH  /appointments/:id
PATCH  /appointments/:id/status
PATCH  /appointments/:id/reschedule
GET    /appointments/:id/history      # AppointmentStatusHistory
```

### Finance
```
GET    /invoices
POST   /invoices
GET    /invoices/:id
POST   /invoices/:id/items
POST   /invoices/:id/payments
POST   /payments/:id/refunds
GET    /payment-methods
POST   /payment-methods
```

### Schedule, Services, Analytics, Search, Activity, Notifications
```
GET    /schedule
GET    /schedule/slots
GET    /services
GET    /service-categories
GET    /analytics/dashboard
GET    /analytics/revenue
GET    /search?q=
GET    /activity                      # ActivityLog feed
POST   /notifications/send            # stub
```

---

## 13. Индексы и производительность

```sql
-- Tenant isolation (на каждой таблице)
CREATE INDEX idx_{table}_org ON {table}(organization_id);

-- Patient search
CREATE INDEX idx_patient_name ON patients(organization_id, last_name, first_name);
CREATE INDEX idx_patient_phone ON patients(organization_id, phone);

-- Appointments
CREATE INDEX idx_appointment_staff_date ON appointments(organization_id, staff_id, starts_at);
CREATE INDEX idx_appointment_branch_date ON appointments(organization_id, branch_id, starts_at);
CREATE INDEX idx_appointment_patient ON appointments(organization_id, patient_id, starts_at);

-- Files (polymorphic)
CREATE INDEX idx_file_entity ON files(organization_id, entity_type, entity_id);

-- Logs
CREATE INDEX idx_audit_entity ON audit_logs(organization_id, entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(organization_id, user_id, created_at DESC);
CREATE INDEX idx_activity_org_date ON activity_logs(organization_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id);

-- Staff roles
CREATE UNIQUE INDEX idx_staff_role_active ON staff_roles(staff_id, role_id) WHERE revoked_at IS NULL;

-- Partial indexes
CREATE INDEX idx_{table}_active ON {table}(organization_id) WHERE deleted_at IS NULL;
```

---

## 14. Архитектурные решения и обоснования

| # | Решение | Почему |
|---|---------|--------|
| 1 | **Organization как tenant** | Изоляция данных нескольких мед. центров в одной инсталляции без отдельных БД |
| 2 | **Branch под Organization** | Филиал — операционная единица; организация — юридическая и tenant-граница |
| 3 | **StaffRole (M:N)** | Реальные сотрудники совмещают роли (врач + админ); union permissions |
| 4 | **Permissions, не role checks** | `@RequirePermissions` масштабируется при добавлении ролей без изменения guards |
| 5 | **Visit как центр клинической истории** | Каждый приём — отдельная сущность с диагнозами, измерениями, рекомендациями |
| 6 | **MedicalRecord как контейнер** | Одна карта на пациента; визиты накапливаются, не перезаписывают друг друга |
| 7 | **Attachment + File** | File — универсальное хранение; Attachment — клинический контекст (тип МРТ, описание) |
| 8 | **Полиморфный File** | Один модуль файлов для всех сущностей; не дублировать upload-логику |
| 9 | **StorageProvider** | Google Drive сейчас, S3 завтра — смена через env без рефакторинга |
| 10 | **Invoice/Payment/Refund** | Частичные оплаты, возвраты, абонементы — без смены схемы |
| 11 | **PaymentMethod как справочник** | Новые способы оплаты (сертификат, депозит) — запись в справочнике |
| 12 | **AuditLog пофилдово** | Точная история: что именно изменилось (требование compliance) |
| 13 | **ActivityLog отдельно** | Бизнес-события для UI и аналитики без шума пофилдовых изменений |
| 14 | **AppointmentStatusHistory** | Полная трассировка жизненного цикла записи включая переносы |
| 15 | **NotificationProvider** | Независимость от конкретного мессенджера; stubs → production |
| 16 | **organization_id везде** | Row-level tenant isolation; подготовка к RLS в PostgreSQL |
| 17 | **Возраст не в БД** | Derived value; исключает рассинхрон при смене даты |
| 18 | **UUID v4** | Безопасность, merge данных между филиалами |
| 19 | **Soft delete** | Восстановление, audit compliance |
| 20 | **PostgreSQL primary** | ACID, relations, analytics; Google Drive — файлы и бэкапы |

---

## 15. Бизнес-правила (доменный уровень)

### 15.1 Возраст
```typescript
Age.fromBirthDate(birthDate) // вычисляется в mapper/DTO, не персистится
```

### 15.2 Скидки (Appointment + InvoiceItem)
```
PERCENT → discount_amount = base × (value / 100)
FIXED   → discount_amount = min(value, base)
NONE    → discount_amount = 0
final   = base - discount_amount
```

### 15.3 История лечения
Timeline пациента = `Visit[]` + `Appointment[]` (будущие), отсортированные по дате.

### 15.4 Invoice balance
```
balance = total_amount - SUM(payments.amount) + SUM(refunds.amount)
status  = PAID if balance = 0; PARTIAL if 0 < balance < total; ...
```

### 15.5 Reschedule
1. Текущая запись → статус `RESCHEDULED`
2. `AppointmentStatusHistory` с metadata `{ oldStartsAt, newStartsAt }`
3. Создаётся новая запись со статусом `CREATED`
4. `ActivityLog`: `appointment.rescheduled`

---

## 16. Безопасность

| Угроза | Мера |
|--------|------|
| SQL Injection | Prisma parameterized queries |
| XSS | CSP, sanitize HTML |
| CSRF | SameSite httpOnly cookies |
| Tenant leak | organization_id filter на каждом запросе |
| Brute force | Rate limiting, lockout |
| Token theft | Refresh rotation, revoke on logout |
| File upload | MIME validation, size limit, checksum |
| RBAC bypass | PermissionsGuard на каждом endpoint |

**JWT:** access 15m, refresh 7d, bcrypt cost 12.

---

## 17. Последовательность разработки (фазы)

### Фаза 0 — Foundation
- Monorepo scaffold (Turborepo, pnpm)
- Docker Compose (PostgreSQL, Redis)
- Prisma schema v2 (все сущности из этого документа)
- NestJS bootstrap, tenant interceptor
- React bootstrap, design tokens
- `@integra/shared` — enums, permissions, Zod-схемы
- `@integra/ui` — базовые компоненты

### Фаза 1 — Auth, Organization, Staff
- Auth (JWT + refresh)
- Organization + Branch CRUD
- Staff CRUD + StaffRole (multi-role)
- PermissionsGuard
- Login + App layout

### Фаза 2 — Patients & Medical Records
- Patient CRUD (расширенная модель)
- MedicalRecord + Visit + Diagnosis + Recommendation
- Patient card UI (tabs)
- AuditLog + ActivityLog

### Фаза 3 — Services, Appointments, Finance
- Services + categories
- Appointment lifecycle + status history
- Invoice + Payment + Refund
- Discount logic

### Фаза 4 — Schedule
- Calendar day/week/month
- Drag-and-drop reschedule
- Status color coding

### Фаза 5 — Files & Storage
- StorageProvider + Google Drive adapter
- Universal File upload
- Attachment linking
- DB backup → Google Drive

### Фаза 6 — Analytics & Dashboard
- Dashboard widgets
- Finance reports
- Activity feed

### Фаза 7 — Notifications & Polish
- NotificationProvider stubs
- E2E critical paths
- Swagger
- Performance audit

---

## 18. Переменные окружения

```env
DATABASE_URL=postgresql://integra:integra@localhost:5432/integra
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
STORAGE_PROVIDER=google_drive
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_FOLDER_ID=
REDIS_URL=redis://localhost:6379
API_PORT=3000
WEB_PORT=5173
CORS_ORIGIN=http://localhost:5173
```

---

## 19. Что нужно утвердить (v2.0)

1. **Organization + Branch** — иерархия tenant корректна?
2. **Multi-role (StaffRole)** — модель `User → Staff → StaffRole → Role`?
3. **Клиническая модель** — Visit как центр истории, Attachment + File?
4. **Finance** — Invoice/Payment/Refund достаточно для абонементов/депозитов?
5. **Audit vs Activity** — разделение понятно?
6. **Appointment statuses** — 8 статусов достаточно?
7. **Роль FINANCE** — добавить в system roles?
8. **Фазы** — порядок приоритетов?

---

*Реализация завершена. См. [README.md](../README.md) для запуска.*
