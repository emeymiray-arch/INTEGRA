import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog } from 'lucide-react';
import { asList } from '@integra/shared';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@integra/ui';
import { apiClient, type StaffMember } from '@/shared/api/client';
import { fullName } from '@/shared/lib/format';
import { CreateStaffDialog } from './CreateStaffDialog';
import { PERMISSIONS, useCan } from '@/shared/lib/permissions';
import { apiErrorMessage } from '@/shared/api/errorMessage';

const roleLabels: Record<string, string> = {
  ADMIN: 'Администратор',
  DOCTOR: 'Врач',
  MASSAGE_THERAPIST: 'Массажист',
  MANAGER: 'Менеджер',
  FINANCE: 'Финансы',
};

export function StaffPage() {
  const queryClient = useQueryClient();
  const canWriteStaff = useCan(PERMISSIONS.STAFF_WRITE);
  const [createOpen, setCreateOpen] = useState(false);
  const { data: staff = [], isLoading, isError } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data } = await apiClient.get('/staff');
      const list = asList<
        StaffMember & { staffRoles?: Array<{ role: { code: string; name: string } }> }
      >(data);
      return list.map((member) => ({
        ...member,
        roles: member.roles ?? member.staffRoles?.map((item) => item.role),
      }));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/staff/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });

  return (
    <div>
      <PageHeader
        title="Сотрудники"
        description="Управление персоналом и ролями"
        actions={
          canWriteStaff ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Добавить сотрудника
          </Button>
          ) : undefined
        }
      />

      {isError && (
        <p className="mb-4 text-sm text-integra-error">Не удалось загрузить сотрудников</p>
      )}
      {remove.isError && (
        <p className="mb-4 text-sm text-integra-error">
          {apiErrorMessage(remove.error, 'Не удалось удалить сотрудника')}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-7 w-7" />}
          title="Сотрудники не найдены"
          description="Добавьте первого сотрудника"
          action={
            canWriteStaff
              ? { label: 'Добавить', onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <Card key={member.id}>
              <div className="flex items-start gap-4">
                <Avatar
                  name={fullName(member)}
                  src={member.avatarUrl}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-integra-gray-900">{fullName(member)}</h3>
                  <p className="text-sm text-integra-gray-600">
                    {member.specialization ?? 'Специалист'}
                  </p>
                  {member.phone && (
                    <p className="mt-1 text-sm text-integra-gray-600">{member.phone}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {member.roles?.map((role) => (
                      <Badge key={role.code} variant="primary">
                        {roleLabels[role.code] ?? role.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                <Badge variant={member.isActive ? 'success' : 'muted'}>
                  {member.isActive ? 'Активен' : 'Неактивен'}
                </Badge>
                {canWriteStaff && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Деактивировать сотрудника?')) remove.mutate(member.id);
                  }}
                >
                  Удалить
                </Button>
                )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <CreateStaffDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
