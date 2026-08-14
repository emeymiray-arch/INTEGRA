import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal } from '@integra/ui';
import { apiClient, type Patient, type Service, type StaffMember } from '@/shared/api/client';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { fullName } from '@/shared/lib/format';
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

function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as { data?: unknown; items?: unknown };
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
}

export function CreateAppointmentDialog({ open, onClose }: CreateAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AppointmentForm>({
    defaultValues: { patientId: '', staffId: '', serviceId: '', startsAt: '' },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients', 'picker'],
    queryFn: async () => {
      const { data } = await apiClient.get('/patients', { params: { limit: 100 } });
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
    if (!open) reset();
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
        <SelectField
          label="Пациент"
          error={errors.patientId?.message}
          {...register('patientId', { required: 'Выберите пациента' })}
        >
          <option value="">Выберите пациента</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {fullName(patient)}
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
        {patients.length === 0 && (
          <p className="text-xs text-integra-gray-600">Сначала добавьте пациента.</p>
        )}
        {services.length === 0 && (
          <p className="text-xs text-integra-gray-600">Сначала добавьте услугу.</p>
        )}
        {mutation.isError && (
          <p className="text-sm text-integra-error">{apiErrorMessage(mutation.error)}</p>
        )}
      </form>
    </Modal>
  );
}
