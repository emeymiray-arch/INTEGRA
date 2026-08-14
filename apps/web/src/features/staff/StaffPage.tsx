import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, UserCog } from 'lucide-react';
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

const roleLabels: Record<string, string> = {
  ADMIN: 'Администратор',
  DOCTOR: 'Врач',
  MASSAGE_THERAPIST: 'Массажист',
  MANAGER: 'Менеджер',
  FINANCE: 'Финансы',
};

export function StaffPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data } = await apiClient.get('/staff');
      const list = (data?.data ?? data ?? []) as Array<
        StaffMember & { staffRoles?: Array<{ role: { code: string; name: string } }> }
      >;
      return list.map((member) => ({
        ...member,
        roles: member.roles ?? member.staffRoles?.map((item) => item.role),
      }));
    },
  });

  return (
    <div>
      <PageHeader
        title="Сотрудники"
        description="Управление персоналом и ролями"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Добавить сотрудника
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-7 w-7" />}
          title="Сотрудники не найдены"
          description="Добавьте первого сотрудника"
          action={{ label: 'Добавить', onClick: () => setCreateOpen(true) }}
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
                <Badge variant={member.isActive ? 'success' : 'muted'}>
                  {member.isActive ? 'Активен' : 'Неактивен'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
      <CreateStaffDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
