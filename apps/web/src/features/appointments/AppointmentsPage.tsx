import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { formatMoney } from '@integra/shared';
import { AppointmentStatus } from '@integra/shared';
import {
  Badge,
  Button,
  DataTable,
  PageHeader,
  type DataTableColumn,
} from '@integra/ui';
import { apiClient, type Appointment } from '@/shared/api/client';
import {
  appointmentBadgeVariant,
  appointmentStatusLabels,
  formatDateTime,
  fullName,
} from '@/shared/lib/format';

export function AppointmentsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', page],
    queryFn: async () => {
      const { data } = await apiClient.get('/appointments', {
        params: { page, limit: 20 },
      });
      return data;
    },
  });

  const appointments: Appointment[] = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, totalPages: 1 };

  const columns: DataTableColumn<Appointment>[] = [
    {
      key: 'startsAt',
      header: 'Дата и время',
      render: (row) => formatDateTime(row.startsAt),
    },
    {
      key: 'patient',
      header: 'Пациент',
      render: (row) => (row.patient ? fullName(row.patient) : '—'),
    },
    {
      key: 'service',
      header: 'Услуга',
      render: (row) => row.service?.name ?? '—',
    },
    {
      key: 'staff',
      header: 'Специалист',
      render: (row) => (row.staff ? fullName(row.staff) : '—'),
    },
    {
      key: 'finalPrice',
      header: 'Стоимость',
      render: (row) => formatMoney(row.finalPrice),
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => (
        <Badge variant={appointmentBadgeVariant[row.status as AppointmentStatus] ?? 'muted'}>
          {appointmentStatusLabels[row.status as AppointmentStatus] ?? row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Записи"
        description="Управление записями на приём"
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Новая запись
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={appointments}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
