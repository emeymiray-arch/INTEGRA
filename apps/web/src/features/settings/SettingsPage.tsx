import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from '@integra/ui';
import { apiClient } from '@/shared/api/client';
import { apiErrorMessage } from '@/shared/api/errorMessage';

interface Organization {
  name: string;
  email?: string | null;
  phone?: string | null;
  settings?: {
    smsReminders?: boolean;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
  };
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [smsReminders, setSmsReminders] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: organization, isError } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const { data } = await apiClient.get<Organization>('/organizations/current');
      return data;
    },
  });

  useEffect(() => {
    if (!organization) return;
    setName(organization.name ?? '');
    setEmail(organization.email ?? '');
    setPhone(organization.phone ?? '');
    setSmsReminders(Boolean(organization.settings?.smsReminders ?? true));
    setEmailNotifications(Boolean(organization.settings?.emailNotifications));
    setPushNotifications(Boolean(organization.settings?.pushNotifications));
  }, [organization]);

  const saveOrg = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch('/organizations/current', {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        settings: { smsReminders, emailNotifications, pushNotifications },
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization'] }),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error('Пароли не совпадают');
      }
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  return (
    <div>
      <PageHeader title="Настройки" description="Параметры организации и безопасности" />

      {isError && (
        <p className="mb-4 text-sm text-integra-error">Не удалось загрузить настройки</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Организация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input label="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {saveOrg.isError && (
              <p className="text-sm text-integra-error">{apiErrorMessage(saveOrg.error)}</p>
            )}
            {saveOrg.isSuccess && (
              <p className="text-sm text-integra-gray-600">Сохранено</p>
            )}
            <Button onClick={() => saveOrg.mutate()} loading={saveOrg.isPending}>
              Сохранить
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Уведомления</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-integra-gray-900">SMS-напоминания о записях</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-integra-gray-200 text-primary"
                checked={smsReminders}
                onChange={(e) => setSmsReminders(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-integra-gray-900">Email-уведомления</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-integra-gray-200 text-primary"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-integra-gray-900">Push-уведомления</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-integra-gray-200 text-primary"
                checked={pushNotifications}
                onChange={(e) => setPushNotifications(e.target.checked)}
              />
            </label>
            <p className="text-xs text-integra-gray-600">
              Сохраняются вместе с данными организации
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Интеграции</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-integra-gray-600">
            <p>Google Drive — хранение медицинских документов</p>
            <p>WhatsApp / Telegram — уведомления пациентам (скоро)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Безопасность</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Текущий пароль"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              label="Новый пароль"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              label="Подтверждение пароля"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {changePassword.isError && (
              <p className="text-sm text-integra-error">
                {apiErrorMessage(changePassword.error, 'Не удалось сменить пароль')}
              </p>
            )}
            {changePassword.isSuccess && (
              <p className="text-sm text-integra-gray-600">Пароль обновлён</p>
            )}
            <Button
              disabled={!currentPassword || newPassword.length < 6}
              onClick={() => changePassword.mutate()}
              loading={changePassword.isPending}
            >
              Сменить пароль
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
