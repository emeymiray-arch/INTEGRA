import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { asList, calculateAge } from '@integra/shared';
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
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
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
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patients', page, debouncedSearch],
    queryFn: async () => {
      const { data } = await apiClient.get('/patients', {
        params: { page, limit: 20, search: debouncedSearch || undefined },
      });
      return data as { items?: Patient[]; total?: number; page?: number; limit?: number };
    },
    placeholderData: keepPreviousData,
  });

  const patients = asList<Patient>(data);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? patients.length) / (data?.limit ?? 20)));

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
        description="Карточки пациентов, по 20 на страницу"
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

      {isError && (
        <p className="mb-4 text-sm text-integra-error">Не удалось загрузить пациентов</p>
      )}

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
          page={data?.page ?? page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(row) => navigate(`/patients/${row.id}`)}
        />
      )}
      <CreatePatientDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
