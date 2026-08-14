import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal } from '@integra/ui';
import { apiClient } from '@/shared/api/client';
import { apiErrorMessage } from '@/shared/api/errorMessage';

interface PatientForm {
  lastName: string;
  firstName: string;
  phone: string;
  birthDate?: string;
}

interface CreatePatientDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreatePatientDialog({ open, onClose }: CreatePatientDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientForm>({
    defaultValues: { lastName: '', firstName: '', phone: '', birthDate: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: PatientForm) => {
      const { data } = await apiClient.post('/patients', {
        lastName: values.lastName.trim(),
        firstName: values.firstName.trim(),
        phone: values.phone.trim(),
        birthDate: values.birthDate || undefined,
      });
      return data;
    },
    onSuccess: (created: { id?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
      onClose();
      if (created?.id) navigate(`/patients/${created.id}`);
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый пациент"
      description="Фамилия, имя, телефон и дата рождения"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="create-patient-form" loading={mutation.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        id="create-patient-form"
        className="space-y-3"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <Input
          label="Фамилия"
          error={errors.lastName?.message}
          {...register('lastName', { required: 'Укажите фамилию' })}
        />
        <Input
          label="Имя"
          error={errors.firstName?.message}
          {...register('firstName', { required: 'Укажите имя' })}
        />
        <Input
          label="Телефон"
          type="tel"
          error={errors.phone?.message}
          {...register('phone', { required: 'Укажите телефон' })}
        />
        <Input label="Дата рождения" type="date" {...register('birthDate')} />
        {mutation.isError && (
          <p className="text-sm text-integra-error">{apiErrorMessage(mutation.error)}</p>
        )}
      </form>
    </Modal>
  );
}
