import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { calculateAge } from '@integra/shared';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  type DataTableColumn,
} from '@integra/ui';
import { apiClient, type Patient } from '@/shared/api/client';
import { fullName } from '@/shared/lib/format';
import { CreatePatientDialog } from './CreatePatientDialog';

const statusVariant: Record<string, 'success' | 'muted' | 'warning' | 'info'> = {
  ACTIVE: 'success',
  INACTIVE: 'muted',
  COMPLETED: 'info',
  ARCHIVED: 'muted',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Активен',
  INACTIVE: 'Неактивен',
  COMPLETED: 'Завершён',
  ARCHIVED: 'Архив',
};

export function PatientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', page, search],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        items?: Patient[];
        data?: Patient[];
        page?: number;
        limit?: number;
        total?: number;
        meta?: { page?: number; totalPages?: number };
      }>('/patients', {
        params: { page, limit: 20, search: search || undefined },
      });
      return data;
    },
  });

  const patients: Patient[] = Array.isArray(data)
    ? data
    : ((data?.items ?? data?.data ?? []) as Patient[]);
  const meta = {
    page: data?.page ?? data?.meta?.page ?? 1,
    totalPages:
      data?.meta?.totalPages ??
      Math.max(1, Math.ceil((data?.total ?? patients.length) / (data?.limit ?? 20))),
  };

  const columns: DataTableColumn<Patient>[] = [
    {
      key: 'name',
      header: 'Пациент',
      render: (row) => <p className="font-medium">{fullName(row)}</p>,
    },
    { key: 'phone', header: 'Телефон' },
    {
      key: 'age',
      header: 'Возраст',
      render: (row) => (row.birthDate ? `${calculateAge(row.birthDate)} лет` : '—'),
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => (
        <Badge variant={statusVariant[row.status] ?? 'muted'}>
          {statusLabels[row.status] ?? row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Пациенты"
        description="Управление карточками пациентов"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Новый пациент
          </Button>
        }
      />

      <div className="mb-6 max-w-sm">
        <Input
          placeholder="Поиск по имени или телефону..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {!isLoading && patients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Пациенты не найдены"
          description="Добавьте первого пациента или измените параметры поиска"
          action={{ label: 'Добавить пациента', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={patients}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          onRowClick={(row) => navigate(`/patients/${row.id}`)}
        />
      )}
      <CreatePatientDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
