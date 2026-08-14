import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Activity,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatMoney } from '@integra/shared';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  StatCard,
  Timeline,
} from '@integra/ui';
import { apiClient, type ActivityItem, type Appointment, type DashboardStats } from '@/shared/api/client';
import { cardItem, cardStagger } from '@/shared/lib/motion';
import { formatDateTime, formatTime } from '@/shared/lib/format';
import { appointmentBadgeVariant, appointmentStatusLabels } from '@/shared/lib/format';
import { AppointmentStatus } from '@integra/shared';

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as { data?: unknown; items?: unknown };
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
}

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>('/analytics/dashboard');
      return data;
    },
  });

  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['appointments', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await apiClient.get('/appointments', {
        params: { date: today, limit: 10 },
      });
      return asArray<Appointment>(data);
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      const { data } = await apiClient.get('/activity', {
        params: { limit: 8 },
      });
      return asArray<ActivityItem>(data);
    },
  });

  return (
    <div>
      <PageHeader
        title="Дашборд"
        description="Обзор деятельности медицинского центра за сегодня"
      />

      <motion.div
        className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        variants={cardStagger}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={cardItem}>
          <StatCard
            title="Записи сегодня"
            value={statsLoading ? '—' : (stats?.todayAppointments ?? 0)}
            icon={<Calendar className="h-6 w-6" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            title="Выручка сегодня"
            value={statsLoading ? '—' : formatMoney(stats?.todayRevenue ?? 0)}
            icon={<DollarSign className="h-6 w-6" />}
            trend={{ value: '+12% к вчера', positive: true }}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            title="Пациентов"
            value={statsLoading ? '—' : (stats?.patientsCount ?? 0)}
            icon={<Users className="h-6 w-6" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            title="Загрузка"
            value="78%"
            subtitle="Средняя за неделю"
            icon={<TrendingUp className="h-6 w-6" />}
          />
        </motion.div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Записи на сегодня</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-integra-gray-600">
                Нет записей на сегодня
              </p>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between rounded-xl border border-integra-gray-100 p-4 transition-colors hover:bg-primary/5"
                  >
                    <div>
                      <p className="font-medium text-integra-gray-900">
                        {apt.patient
                          ? `${apt.patient.lastName} ${apt.patient.firstName}`
                          : 'Пациент'}
                      </p>
                      <p className="text-sm text-integra-gray-600">
                        {apt.service?.name} · {apt.staff ? `${apt.staff.lastName} ${apt.staff.firstName}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-primary">{formatTime(apt.startsAt)}</p>
                      <Badge
                        variant={
                          appointmentBadgeVariant[apt.status as AppointmentStatus] ?? 'muted'
                        }
                      >
                        {appointmentStatusLabels[apt.status as AppointmentStatus] ?? apt.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-secondary" />
              Активность
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              items={activity.map((item) => ({
                id: item.id,
                title: item.eventType.replace(/\./g, ' · '),
                description: item.user
                  ? `${item.user.lastName ?? ''} ${item.user.firstName ?? ''}`.trim() ||
                    undefined
                  : undefined,
                date: formatDateTime(item.createdAt),
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Популярные услуги</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(stats?.popularServices ?? []).map((service, i) => (
              <div
                key={service.id}
                className="flex items-center gap-4 rounded-xl bg-integra-gray-50 p-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-integra-gray-900">{service.name}</p>
                  <p className="text-sm text-integra-gray-600">{service.count} записей</p>
                </div>
              </div>
            ))}
            {!stats?.popularServices?.length && (
              <p className="col-span-full py-4 text-center text-sm text-integra-gray-600">
                Данные загружаются...
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
