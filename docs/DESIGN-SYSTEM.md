# INTEGRA — Design System

## Бренд

- **Название:** INTEGRA
- **Слоган:** «Целостный подход к здоровью»
- **Характер:** Профессиональный, спокойный, премиальный медицинский

## Цвета

```css
:root {
  /* Primary — тёмный бирюзовый */
  --integra-primary-900: #0A3D3D;
  --integra-primary-800: #0D4F4F;
  --integra-primary-700: #1A6B6B;
  --integra-primary-600: #2A8585;
  --integra-primary-500: #4A9B9B;

  /* Neutrals */
  --integra-white: #FFFFFF;
  --integra-gray-50: #F5F7F7;
  --integra-gray-100: #E8ECEB;
  --integra-gray-200: #D1D9D8;
  --integra-gray-400: #9AABA9;
  --integra-gray-600: #6B7B7B;
  --integra-gray-900: #1A2E2E;

  /* Accent — тёплый янтарь (скидки, CTA, предупреждения) */
  --integra-accent-500: #E8913A;
  --integra-accent-600: #D47A2A;

  /* Accent — коралл (destructive, alerts) */
  --integra-coral-500: #E07A5F;

  /* Semantic */
  --integra-success: #2D8F6F;
  --integra-warning: #E8913A;
  --integra-error: #D64545;
  --integra-info: #4A9B9B;
}
```

## Tailwind config (фрагмент)

```js
colors: {
  primary: {
    DEFAULT: '#0D4F4F',
    light: '#1A6B6B',
    dark: '#0A3D3D',
  },
  secondary: '#4A9B9B',
  accent: {
    DEFAULT: '#E8913A',
    coral: '#E07A5F',
  },
  surface: '#FFFFFF',
  background: '#F5F7F7',
}
```

## Статусы записей (календарь)

| Статус | Цвет | HEX |
|--------|------|-----|
| CREATED | Светло-серый | `#D1D9D8` |
| CONFIRMED | Бирюзовый | `#1A6B6B` |
| ARRIVED | Сине-зелёный | `#4A9B9B` |
| IN_PROGRESS | Янтарь | `#E8913A` |
| COMPLETED | Зелёный | `#2D8F6F` |
| CANCELLED | Серый | `#9AABA9` |
| NO_SHOW | Коралл | `#E07A5F` |
| RESCHEDULED | Фиолетово-серый | `#8B9BA9` |

## Статусы счёта (Invoice)

| Статус | Badge variant |
|--------|---------------|
| DRAFT | `muted` |
| ISSUED | `info` |
| PARTIAL | `accent` |
| PAID | `success` |
| CANCELLED | `muted` |
| REFUNDED | `warning` |

## Компоненты (@integra/ui)

### Базовые
- `Button` — primary, secondary, ghost, danger, accent
- `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`
- `Badge`, `Avatar`, `Tooltip`

### Композитные
- `Card` — rounded-2xl, padding variants
- `DataTable` — sortable, paginated, skeleton
- `Modal`, `Drawer`, `Dropdown`
- `Tabs`, `Breadcrumb`
- `DatePicker`, `TimePicker`
- `FileUpload` — drag-and-drop zone
- `SearchCommand` — Cmd+K palette
- `StatCard` — dashboard metrics
- `Timeline` — история лечения
- `CalendarGrid` — day/week/month views

### Layout
- `AppShell` — sidebar + header + content
- `Sidebar` — навигация с иконками (Lucide)
- `PageHeader` — title + actions
- `EmptyState`

## Анимации (Framer Motion)

```ts
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

export const cardStagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const cardItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};
```

## Иконки

**Lucide React** — единый набор, stroke-width: 1.5

## Spacing scale

4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px

## Border radius

- `sm`: 6px (inputs)
- `md`: 12px (buttons)
- `lg`: 16px (cards)
- `xl`: 20px (modals)
- `2xl`: 24px (main cards)

## Тени

```css
--shadow-sm: 0 1px 2px rgba(13, 79, 79, 0.05);
--shadow-md: 0 4px 12px rgba(13, 79, 79, 0.08);
--shadow-lg: 0 8px 24px rgba(13, 79, 79, 0.12);
```
