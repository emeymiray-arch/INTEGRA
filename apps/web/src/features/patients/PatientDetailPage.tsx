import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { calculateAge } from '@integra/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FileUpload,
  Input,
  PageHeader,
} from '@integra/ui';
import { apiClient, type Patient } from '@/shared/api/client';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { fullName } from '@/shared/lib/format';
import { SelectField } from '@/shared/ui/SelectField';

interface MedicalVisit {
  id: string;
  visitedAt: string;
  diagnoses: Array<{ id: string; title: string; description?: string }>;
  recommendations: Array<{ id: string; content: string }>;
}

interface PatientFile {
  id: string;
  filename: string;
  mimeType: string;
  previewUrl?: string;
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [diagnosisTitle, setDiagnosisTitle] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [notes, setNotes] = useState('');

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Patient>(`/patients/${id}`);
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!patient) return;
    setBirthDate(patient.birthDate ? patient.birthDate.slice(0, 10) : '');
    setGender(patient.gender ?? '');
    setNotes(patient.notes ?? '');
  }, [patient]);

  const { data: record } = useQuery({
    queryKey: ['patient', id, 'record'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/medical-records/patient/${id}`);
      return data as { visits?: MedicalVisit[] };
    },
    enabled: !!id,
  });

  const { data: files = [], refetch: refetchFiles } = useQuery({
    queryKey: ['patient', id, 'files'],
    queryFn: async () => {
      const { data } = await apiClient.get('/files', {
        params: { entityType: 'Patient', entityId: id },
      });
      return (Array.isArray(data) ? data : []) as PatientFile[];
    },
    enabled: !!id,
  });

  const diagnoses = useMemo(
    () => (record?.visits ?? []).flatMap((visit) => visit.diagnoses ?? []),
    [record],
  );
  const recommendations = useMemo(
    () => (record?.visits ?? []).flatMap((visit) => visit.recommendations ?? []),
    [record],
  );

  const saveInfo = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch(`/patients/${id}`, {
        birthDate: birthDate || undefined,
        gender: gender || undefined,
        notes: notes || undefined,
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient', id] }),
  });

  const addDiagnosis = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/medical-records/patient/${id}/diagnoses`, {
        title: diagnosisTitle.trim(),
      });
      return data;
    },
    onSuccess: () => {
      setDiagnosisTitle('');
      queryClient.invalidateQueries({ queryKey: ['patient', id, 'record'] });
    },
  });

  const addRecommendation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/medical-records/patient/${id}/recommendations`, {
        content: recommendation.trim(),
      });
      return data;
    },
    onSuccess: () => {
      setRecommendation('');
      queryClient.invalidateQueries({ queryKey: ['patient', id, 'record'] });
    },
  });

  const uploadPhotos = useMutation({
    mutationFn: async (selected: File[]) => {
      for (const file of selected) {
        const form = new FormData();
        form.append('file', file);
        await apiClient.post(`/files/upload?entityType=Patient&entityId=${id}`, form);
      }
    },
    onSuccess: () => refetchFiles(),
  });

  if (isLoading || !patient) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const age = patient.birthDate ? `${calculateAge(patient.birthDate)} лет` : 'не указан';

  return (
    <div>
      <PageHeader
        title={fullName(patient)}
        description={`${patient.phone} · возраст ${age}`}
        breadcrumbs={
          <Button variant="ghost" size="sm" onClick={() => navigate('/patients')}>
            <ArrowLeft className="h-4 w-4" />
            К списку пациентов
          </Button>
        }
        actions={
          <Badge variant={patient.status === 'ACTIVE' ? 'success' : 'muted'}>
            {patient.status === 'ACTIVE' ? 'Активен' : patient.status}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Базовая информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-integra-gray-600">Возраст</span>
              <span className="font-medium">{age}</span>
            </div>
            <Input
              label="Дата рождения"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            <SelectField label="Пол" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Не указан</option>
              <option value="MALE">Мужской</option>
              <option value="FEMALE">Женский</option>
              <option value="OTHER">Другой</option>
            </SelectField>
            <Input
              label="Заметки"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {saveInfo.isError && (
              <p className="text-sm text-integra-error">{apiErrorMessage(saveInfo.error)}</p>
            )}
            <Button onClick={() => saveInfo.mutate()} loading={saveInfo.isPending}>
              Сохранить данные
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Диагноз</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {diagnoses.length === 0 ? (
              <p className="text-sm text-integra-gray-600">Диагнозы ещё не добавлены</p>
            ) : (
              <ul className="space-y-2">
                {diagnoses.map((item) => (
                  <li key={item.id} className="rounded-xl bg-integra-gray-50 px-3 py-2 text-sm">
                    <p className="font-medium text-integra-gray-900">{item.title}</p>
                    {item.description && (
                      <p className="text-integra-gray-600">{item.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Input
              label="Новый диагноз"
              value={diagnosisTitle}
              onChange={(e) => setDiagnosisTitle(e.target.value)}
              placeholder="Например: остеохондроз"
            />
            {addDiagnosis.isError && (
              <p className="text-sm text-integra-error">{apiErrorMessage(addDiagnosis.error)}</p>
            )}
            <Button
              disabled={!diagnosisTitle.trim()}
              onClick={() => addDiagnosis.mutate()}
              loading={addDiagnosis.isPending}
            >
              Добавить диагноз
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Рекомендации</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.length === 0 ? (
              <p className="text-sm text-integra-gray-600">Рекомендаций пока нет</p>
            ) : (
              <ul className="space-y-2">
                {recommendations.map((item) => (
                  <li key={item.id} className="rounded-xl bg-integra-gray-50 px-3 py-2 text-sm">
                    {item.content}
                  </li>
                ))}
              </ul>
            )}
            <Input
              label="Новая рекомендация"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Например: массаж 2 раза в неделю"
            />
            {addRecommendation.isError && (
              <p className="text-sm text-integra-error">
                {apiErrorMessage(addRecommendation.error)}
              </p>
            )}
            <Button
              disabled={!recommendation.trim()}
              onClick={() => addRecommendation.mutate()}
              loading={addRecommendation.isPending}
            >
              Добавить рекомендацию
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Фото</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.filter((file) => file.mimeType.startsWith('image/')).length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {files
                  .filter((file) => file.mimeType.startsWith('image/'))
                  .map((file) => (
                    <figure key={file.id} className="overflow-hidden rounded-xl border border-integra-gray-100">
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.filename}
                          className="h-36 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-36 items-center justify-center text-xs text-integra-gray-600">
                          {file.filename}
                        </div>
                      )}
                    </figure>
                  ))}
              </div>
            )}
            <FileUpload
              accept="image/jpeg,image/png,image/webp"
              multiple
              maxSizeMb={5}
              onFilesSelected={(selected) => {
                if (selected.length) uploadPhotos.mutate(selected);
              }}
            />
            {uploadPhotos.isError && (
              <p className="text-sm text-integra-error">{apiErrorMessage(uploadPhotos.error)}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
