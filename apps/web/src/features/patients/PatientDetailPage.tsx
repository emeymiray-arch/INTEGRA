import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Heart, History, Wallet } from 'lucide-react';
import { calculateAge, formatMoney } from '@integra/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  FileUpload,
  PageHeader,
  TabPanel,
  Tabs,
  Timeline,
  type DataTableColumn,
} from '@integra/ui';
import { apiClient, type Invoice, type Patient } from '@/shared/api/client';
import { formatDate, formatDateTime, fullName } from '@/shared/lib/format';

const tabs = [
  { id: 'general', label: 'Общее', icon: <Heart className="h-4 w-4" /> },
  { id: 'medical', label: 'Медицина', icon: <FileText className="h-4 w-4" /> },
  { id: 'history', label: 'История', icon: <History className="h-4 w-4" /> },
  { id: 'documents', label: 'Документы', icon: <FileText className="h-4 w-4" /> },
  { id: 'finance', label: 'Финансы', icon: <Wallet className="h-4 w-4" /> },
];

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Patient>(`/patients/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['patient', id, 'visits'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/patients/${id}/medical-record`);
      return data?.visits ?? [];
    },
    enabled: !!id && (activeTab === 'medical' || activeTab === 'history'),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['patient', id, 'invoices'],
    queryFn: async () => {
      const { data } = await apiClient.get('/invoices', {
        params: { patientId: id },
      });
      return data?.data ?? data ?? [];
    },
    enabled: !!id && activeTab === 'finance',
  });

  if (isLoading || !patient) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const invoiceColumns: DataTableColumn<Invoice>[] = [
    { key: 'number', header: 'Счёт' },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => <Badge variant="info">{row.status}</Badge>,
    },
    {
      key: 'totalAmount',
      header: 'Сумма',
      render: (row) => formatMoney(row.totalAmount),
    },
    {
      key: 'balance',
      header: 'Остаток',
      render: (row) => formatMoney(row.balance),
    },
    {
      key: 'issuedAt',
      header: 'Дата',
      render: (row) => (row.issuedAt ? formatDate(row.issuedAt) : '—'),
    },
  ];

  return (
    <div>
      <PageHeader
        title={fullName(patient)}
        description={[patient.phone, patient.email].filter(Boolean).join(' · ')}
        breadcrumbs={
          <Button variant="ghost" size="sm" onClick={() => navigate('/patients')}>
            <ArrowLeft className="h-4 w-4" />
            К списку пациентов
          </Button>
        }
        actions={
          <Badge variant={patient.status === 'ACTIVE' ? 'success' : 'muted'}>
            {patient.status}
          </Badge>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <TabPanel>
        {activeTab === 'general' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Личные данные</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-integra-gray-600">Дата рождения</span>
                  <span>{patient.birthDate ? formatDate(patient.birthDate) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-integra-gray-600">Возраст</span>
                  <span>{patient.birthDate ? `${calculateAge(patient.birthDate)} лет` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-integra-gray-600">Пол</span>
                  <span>{patient.gender ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-integra-gray-600">Источник</span>
                  <span>{patient.source ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-integra-gray-600">Зарегистрирован</span>
                  <span>{formatDate(patient.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Заметки</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-integra-gray-600">
                  {patient.notes || 'Нет заметок'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'medical' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Аллергии и противопоказания</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="font-medium text-integra-gray-900">Аллергии</p>
                  <p className="mt-1 text-integra-gray-600">{patient.allergies || 'Не указаны'}</p>
                </div>
                <div>
                  <p className="font-medium text-integra-gray-900">Противопоказания</p>
                  <p className="mt-1 text-integra-gray-600">
                    {patient.contraindications || 'Не указаны'}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-integra-gray-900">Хронические заболевания</p>
                  <p className="mt-1 text-integra-gray-600">
                    {patient.chronicDiseases || 'Не указаны'}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Последние визиты</CardTitle>
              </CardHeader>
              <CardContent>
                {visits.length === 0 ? (
                  <p className="text-sm text-integra-gray-600">Визиты отсутствуют</p>
                ) : (
                  <Timeline
                    items={visits.slice(0, 5).map((v: { id: string; visitedAt: string; chiefComplaint?: string; status: string }) => ({
                      id: v.id,
                      title: v.chiefComplaint || 'Визит',
                      description: v.status,
                      date: formatDateTime(v.visitedAt),
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'history' && (
          <Card>
            <CardHeader>
              <CardTitle>История лечения</CardTitle>
            </CardHeader>
            <CardContent>
              {visits.length === 0 ? (
                <EmptyState title="История пуста" description="Визиты появятся после первого приёма" />
              ) : (
                <Timeline
                  items={visits.map((v: { id: string; visitedAt: string; clinicalNotes?: string; status: string }) => ({
                    id: v.id,
                    title: `Визит · ${v.status}`,
                    description: v.clinicalNotes,
                    date: formatDateTime(v.visitedAt),
                  }))}
                />
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <CardHeader>
              <CardTitle>Документы</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                multiple
                onFilesSelected={() => {}}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'finance' && (
          <DataTable
            columns={invoiceColumns}
            data={invoices}
            keyExtractor={(row) => row.id}
            emptyMessage="Счета отсутствуют"
          />
        )}
      </TabPanel>
    </div>
  );
}
