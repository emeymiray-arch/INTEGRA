import { Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from '@integra/ui';

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Настройки"
        description="Параметры организации и интеграции"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Организация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Название" placeholder="Медицинский центр INTEGRA" />
            <Input label="Email" type="email" placeholder="info@integra.ru" />
            <Input label="Телефон" placeholder="+7 (999) 000-00-00" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Уведомления</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-integra-gray-900">SMS-напоминания о записях</span>
              <input type="checkbox" className="h-4 w-4 rounded border-integra-gray-200 text-primary" defaultChecked />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-integra-gray-900">Email-уведомления</span>
              <input type="checkbox" className="h-4 w-4 rounded border-integra-gray-200 text-primary" />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-integra-gray-900">Push-уведомления</span>
              <input type="checkbox" className="h-4 w-4 rounded border-integra-gray-200 text-primary" />
            </label>
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
            <Input label="Текущий пароль" type="password" />
            <Input label="Новый пароль" type="password" />
            <Input label="Подтверждение пароля" type="password" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
