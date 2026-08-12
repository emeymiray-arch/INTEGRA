import { AppointmentStatus } from '@integra/shared';

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  [AppointmentStatus.CREATED]: 'Создана',
  [AppointmentStatus.CONFIRMED]: 'Подтверждена',
  [AppointmentStatus.ARRIVED]: 'Пришёл',
  [AppointmentStatus.IN_PROGRESS]: 'В процессе',
  [AppointmentStatus.COMPLETED]: 'Завершена',
  [AppointmentStatus.CANCELLED]: 'Отменена',
  [AppointmentStatus.NO_SHOW]: 'Не явился',
  [AppointmentStatus.RESCHEDULED]: 'Перенесена',
};

export const appointmentStatusColors: Record<AppointmentStatus, string> = {
  [AppointmentStatus.CREATED]: 'bg-appointment-created',
  [AppointmentStatus.CONFIRMED]: 'bg-appointment-confirmed',
  [AppointmentStatus.ARRIVED]: 'bg-appointment-arrived',
  [AppointmentStatus.IN_PROGRESS]: 'bg-appointment-in_progress',
  [AppointmentStatus.COMPLETED]: 'bg-appointment-completed',
  [AppointmentStatus.CANCELLED]: 'bg-appointment-cancelled',
  [AppointmentStatus.NO_SHOW]: 'bg-appointment-no_show',
  [AppointmentStatus.RESCHEDULED]: 'bg-appointment-rescheduled',
};

export const appointmentBadgeVariant: Record<
  AppointmentStatus,
  'muted' | 'primary' | 'info' | 'accent' | 'success' | 'error' | 'warning'
> = {
  [AppointmentStatus.CREATED]: 'muted',
  [AppointmentStatus.CONFIRMED]: 'primary',
  [AppointmentStatus.ARRIVED]: 'info',
  [AppointmentStatus.IN_PROGRESS]: 'accent',
  [AppointmentStatus.COMPLETED]: 'success',
  [AppointmentStatus.CANCELLED]: 'muted',
  [AppointmentStatus.NO_SHOW]: 'error',
  [AppointmentStatus.RESCHEDULED]: 'warning',
};

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(new Date(date));
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function fullName(
  person: { firstName: string; lastName: string; middleName?: string },
) {
  return [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(' ');
}
