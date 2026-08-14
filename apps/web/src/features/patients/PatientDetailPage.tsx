import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { asList, calculateAge } from '@integra/shared';
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
import { AuthImage } from '@/shared/ui/AuthImage';
import { PERMISSIONS, useCan } from '@/shared/lib/permissions';

interface MedicalVisit {
  id: string;
  diagnoses: Array<{ id: string; title: string; description?: string }>;
  recommendations: Array<{ id: string; content: string }>;
}

interface PatientFile {
  id: string;
  filename: string;
  mimeType: string;
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canDeletePatient = useCan(PERMISSIONS.PATIENTS_DELETE);
  const [diagnosisTitle, setDiagnosisTitle] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [notes, setNotes] = useState('');

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Patient>(`/patients/${id}`);
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!patient) return;
    setLastName(patient.lastName ?? '');
    setFirstName(patient.firstName ?? '');
    setPhone(patient.phone ?? '');
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
      return asList<PatientFile>(data);
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
  const photos = files.filter((file) => file.mimeType.startsWith('image/')).slice(0, 12);

  const saveInfo = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch(`/patients/${id}`, {
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        phone: phone.trim(),
        birthDate: birthDate || undefined,
        gender: gender || undefined,
        notes: notes || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const addDiagnosis = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/medical-records/patient/${id}/diagnoses`, {
        title: diagnosisTitle.trim(),
      });
    },
    onSuccess: () => {
      setDiagnosisTitle('');
      queryClient.invalidateQueries({ queryKey: ['patient', id, 'record'] });
    },
  });

  const removeDiagnosis = useMutation({
    mutationFn: async (diagnosisId: string) => {
      await apiClient.delete(`/medical-records/diagnoses/${diagnosisId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient', id, 'record'] }),
  });

  const addRecommendation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/medical-records/patient/${id}/recommendations`, {
        content: recommendation.trim(),
      });
    },
    onSuccess: () => {
      setRecommendation('');
      queryClient.invalidateQueries({ queryKey: ['patient', id, 'record'] });
    },
  });

  const removeRecommendation = useMutation({
    mutationFn: async (recommendationId: string) => {
      await apiClient.delete(`/medical-records/recommendations/${recommendationId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient', id, 'record'] }),
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

  const removePhoto = useMutation({
    mutationFn: async (fileId: string) => {
      await apiClient.delete(`/files/${fileId}`);
    },
    onSuccess: () => refetchFiles(),
  });

  const removePatient = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/patients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      navigate('/patients');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-integra-error">Не удалось открыть карточку пациента</p>
        <Button className="mt-4" variant="ghost" onClick={() => navigate('/patients')}>
          К списку
        </Button>
      </div>
    );
  }

  const age = patient.birthDate ? `${calculateAge(patient.birthDate)} лет` : 'возраст не указан';

  return (
    <div>
      <PageHeader
        title={fullName(patient)}
        description={`${patient.phone} · ${age}`}
        breadcrumbs={
          <Button variant="ghost" size="sm" onClick={() => navigate('/patients')}>
            <ArrowLeft className="h-4 w-4" />
            К списку пациентов
          </Button>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={patient.status === 'ACTIVE' ? 'success' : 'muted'}>
              {patient.status === 'ACTIVE' ? 'Активен' : patient.status}
            </Badge>
            {canDeletePatient && (
            <Button
              variant="danger"
              size="sm"
              loading={removePatient.isPending}
              onClick={() => {
                if (window.confirm('Архивировать карточку пациента?')) removePatient.mutate();
              }}
            >
              Удалить
            </Button>
            )}
          </div>
        }
      />

      {(removePatient.isError ||
        removeDiagnosis.isError ||
        removeRecommendation.isError ||
        removePhoto.isError) && (
        <p className="mb-4 text-sm text-integra-error">
          {apiErrorMessage(
            removePatient.error ??
              removeDiagnosis.error ??
              removeRecommendation.error ??
              removePhoto.error,
            'Не удалось удалить',
          )}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Базовая информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input label="Фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input label="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input label="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
            <Input label="Заметки" value={notes} onChange={(e) => setNotes(e.target.value)} />
            {saveInfo.isError && (
              <p className="text-sm text-integra-error">{apiErrorMessage(saveInfo.error)}</p>
            )}
            <Button onClick={() => saveInfo.mutate()} loading={saveInfo.isPending}>
              Сохранить
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
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-xl bg-integra-gray-50 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-integra-gray-900">{item.title}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Удалить диагноз?')) removeDiagnosis.mutate(item.id);
                      }}
                    >
                      Удалить
                    </Button>
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
              Добавить
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
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-xl bg-integra-gray-50 px-3 py-2 text-sm"
                  >
                    <span>{item.content}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Удалить рекомендацию?')) {
                          removeRecommendation.mutate(item.id);
                        }
                      }}
                    >
                      Удалить
                    </Button>
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
              Добавить
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Фото</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((file) => (
                  <figure
                    key={file.id}
                    className="relative overflow-hidden rounded-xl border border-integra-gray-100"
                  >
                    <AuthImage fileId={file.id} alt={file.filename} className="h-36 w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs text-integra-error"
                      onClick={() => {
                        if (window.confirm('Удалить фото?')) removePhoto.mutate(file.id);
                      }}
                    >
                      Удалить
                    </button>
                  </figure>
                ))}
              </div>
            )}
            <FileUpload
              accept="image/jpeg,image/png,image/webp"
              multiple
              maxSizeMb={2}
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
