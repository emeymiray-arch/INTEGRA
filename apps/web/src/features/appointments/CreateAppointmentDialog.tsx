import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { asList } from '@integra/shared';
import { Button, Input, Modal } from '@integra/ui';
import { apiClient, type Patient, type Service, type StaffMember } from '@/shared/api/client';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { fullName } from '@/shared/lib/format';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { SelectField } from '@/shared/ui/SelectField';

interface AppointmentForm {
  patientId: string;
  staffId: string;
  serviceId: string;
  startsAt: string;
}

interface Branch {
  id: string;
  name: string;
}

interface StaffOption extends StaffMember {
  branchId?: string;
  branch?: { id: string; name: string };
}

interface CreateAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateAppointmentDialog({ open, onClose }: CreateAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedPatient = useDebouncedValue(patientQuery, 300);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AppointmentForm>({
    defaultValues: { patientId: '', staffId: '', serviceId: '', startsAt: '' },
  });

  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', 'picker', debouncedPatient],
    queryFn: async () => {
      const { data } = await apiClient.get('/patients', {
        params: { limit: 20, search: debouncedPatient || undefined },
      });
      return asList<Patient>(data);
    },
    enabled: open,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff', 'picker'],
    queryFn: async () => {
      const { data } = await apiClient.get('/staff');
      return asList<StaffOption>(data);
    },
    enabled: open,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', 'picker'],
    queryFn: async () => {
      const { data } = await apiClient.get('/services');
      return asList<Service>(data);
    },
    enabled: open,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await apiClient.get('/branches');
      return asList<Branch>(data);
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      reset();
      setPatientQuery('');
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (values: AppointmentForm) => {
      const specialist = staff.find((member) => member.id === values.staffId);
      const branchId =
        specialist?.branchId ?? specialist?.branch?.id ?? branches[0]?.id;
      if (!branchId) {
        throw new Error('Нет филиала. Сначала добавьте сотрудника или филиал.');
      }
      const { data } = await apiClient.post('/appointments', {
        patientId: values.patientId,
        staffId: values.staffId,
        serviceId: values.serviceId,
        branchId,
        startsAt: new Date(values.startsAt).toISOString(),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая запись"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="create-appointment-form" loading={mutation.isPending}>
            Записать
          </Button>
        </>
      }
    >
      <form
        id="create-appointment-form"
        className="space-y-3"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <Input
          label="Найти пациента"
          value={patientQuery}
          onChange={(e) => setPatientQuery(e.target.value)}
          placeholder="Имя или телефон"
        />
        <SelectField
          label="Пациент"
          error={errors.patientId?.message}
          {...register('patientId', { required: 'Выберите пациента' })}
        >
          <option value="">Выберите пациента</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {fullName(patient)} · {patient.phone}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Специалист"
          error={errors.staffId?.message}
          {...register('staffId', { required: 'Выберите специалиста' })}
        >
          <option value="">Выберите специалиста</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {fullName(member)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Услуга"
          error={errors.serviceId?.message}
          {...register('serviceId', { required: 'Выберите услугу' })}
        >
          <option value="">Выберите услугу</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </SelectField>
        <Input
          label="Дата и время"
          type="datetime-local"
          error={errors.startsAt?.message}
          {...register('startsAt', { required: 'Укажите дату и время' })}
        />
        {patientsLoading && (
          <p className="text-xs text-integra-gray-600">Ищем пациентов…</p>
        )}
        {!patientsLoading && patients.length === 0 && (
          <p className="text-xs text-integra-gray-600">
            Пациент не найден — добавьте его в разделе «Пациенты».
          </p>
        )}
        {mutation.isError && (
          <p className="text-sm text-integra-error">{apiErrorMessage(mutation.error)}</p>
        )}
      </form>
    </Modal>
  );
}
