import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { asList, formatMoney } from '@integra/shared';
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
import { CreateAppointmentDialog } from './CreateAppointmentDialog';
import { PERMISSIONS, useCan } from '@/shared/lib/permissions';
import { apiErrorMessage } from '@/shared/api/errorMessage';

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const canWriteAppointments = useCan(PERMISSIONS.APPOINTMENTS_WRITE);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['appointments', page],
    queryFn: async () => {
      const { data } = await apiClient.get('/appointments', {
        params: { page, limit: 20 },
      });
      return data as { items?: Appointment[]; total?: number; page?: number; limit?: number };
    },
  });

  const appointments = asList<Appointment>(data);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? appointments.length) / (data?.limit ?? 20)));

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/appointments/${id}/status`, { status: 'CANCELLED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

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
      render: (row) => formatMoney(Number(row.finalPrice)),
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant={appointmentBadgeVariant[row.status as AppointmentStatus] ?? 'muted'}>
            {appointmentStatusLabels[row.status as AppointmentStatus] ?? row.status}
          </Badge>
          {canWriteAppointments &&
            row.status !== 'CANCELLED' &&
            row.status !== 'COMPLETED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Отменить эту запись?')) cancel.mutate(row.id);
              }}
            >
              Отменить
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Записи"
        description="Все записи, новые сверху"
        actions={
          canWriteAppointments ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Новая запись
          </Button>
          ) : undefined
        }
      />

      {isError && (
        <p className="mb-4 text-sm text-integra-error">Не удалось загрузить записи</p>
      )}
      {cancel.isError && (
        <p className="mb-4 text-sm text-integra-error">
          {apiErrorMessage(cancel.error, 'Не удалось отменить запись')}
        </p>
      )}

      <DataTable
        columns={columns}
        data={appointments}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        page={data?.page ?? page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="Записей нет"
      />
      <CreateAppointmentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
