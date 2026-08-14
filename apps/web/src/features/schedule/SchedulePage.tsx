import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppointmentStatus, asList } from '@integra/shared';
import { Button, Card, PageHeader } from '@integra/ui';
import { apiClient, type Appointment } from '@/shared/api/client';
import {
  appointmentStatusColors,
  appointmentStatusLabels,
  formatTime,
  fullName,
} from '@/shared/lib/format';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekDates(base: Date) {
  const start = startOfDay(base);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function SchedulePage() {
  const [weekStart, setWeekStart] = useState(new Date());

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const { data: appointments = [], isLoading, isError } = useQuery({
    queryKey: ['schedule', weekDates[0].toDateString()],
    queryFn: async () => {
      const from = new Date(weekDates[0]);
      from.setHours(0, 0, 0, 0);
      const to = new Date(weekDates[6]);
      to.setHours(23, 59, 59, 999);
      const { data } = await apiClient.get('/appointments', {
        params: {
          from: from.toISOString(),
          to: to.toISOString(),
          limit: 200,
          page: 1,
        },
      });
      return asList<Appointment>(data);
    },
  });

  const getAppointmentsForSlot = (date: Date, hour: number) =>
    appointments.filter((apt) => {
      const start = new Date(apt.startsAt);
      return isSameDay(start, date) && start.getHours() === hour;
    });

  const shiftWeek = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  return (
    <div>
      <PageHeader
        title="Расписание"
        description="Недельный вид календаря"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => shiftWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-integra-gray-900">
              {weekDates[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              {' — '}
              {weekDates[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => shiftWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.values(AppointmentStatus).map((status) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-integra-gray-600">
            <span className={`h-3 w-3 rounded-full ${appointmentStatusColors[status]}`} />
            {appointmentStatusLabels[status]}
          </div>
        ))}
      </div>

      {isError && (
        <p className="mb-4 text-sm text-integra-error">Не удалось загрузить расписание</p>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-8 border-b border-integra-gray-100 bg-integra-gray-50/50">
              <div className="p-3 text-xs font-semibold uppercase text-integra-gray-600" />
              {weekDates.map((date, i) => (
                <div
                  key={i}
                  className={`border-l border-integra-gray-100 p-3 text-center ${
                    isSameDay(date, new Date()) ? 'bg-primary/5' : ''
                  }`}
                >
                  <p className="text-xs font-semibold uppercase text-integra-gray-600">
                    {DAYS[i]}
                  </p>
                  <p className="text-lg font-bold text-integra-gray-900">{date.getDate()}</p>
                </div>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b border-integra-gray-50 last:border-0">
                  <div className="flex items-start justify-end p-2 pr-3 text-xs text-integra-gray-400">
                    {`${hour}:00`}
                  </div>
                  {weekDates.map((date, di) => (
                    <div
                      key={di}
                      className="min-h-[72px] border-l border-integra-gray-50 p-1"
                    >
                      {getAppointmentsForSlot(date, hour).map((apt) => (
                        <div
                          key={apt.id}
                          className={`mb-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs text-white shadow-sm ${
                            appointmentStatusColors[apt.status as AppointmentStatus] ??
                            'bg-appointment-created'
                          }`}
                        >
                          <p className="truncate font-medium">
                            {apt.patient ? fullName(apt.patient) : 'Запись'}
                          </p>
                          <p className="truncate opacity-80">
                            {formatTime(apt.startsAt)} · {apt.service?.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
