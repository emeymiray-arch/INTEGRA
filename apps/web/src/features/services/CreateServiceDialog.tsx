import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal } from '@integra/ui';
import { apiClient } from '@/shared/api/client';
import { apiErrorMessage } from '@/shared/api/errorMessage';

interface ServiceForm {
  name: string;
  durationMinutes: number;
  price: number;
  description?: string;
}

interface CreateServiceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateServiceDialog({ open, onClose }: CreateServiceDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServiceForm>({
    defaultValues: { name: '', durationMinutes: 60, price: 0, description: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: ServiceForm) => {
      const { data } = await apiClient.post('/services', {
        name: values.name.trim(),
        durationMinutes: Number(values.durationMinutes),
        price: Number(values.price),
        description: values.description?.trim() || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая услуга"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="create-service-form" loading={mutation.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        id="create-service-form"
        className="space-y-3"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <Input
          label="Название"
          error={errors.name?.message}
          {...register('name', { required: 'Укажите название' })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Длительность, мин"
            type="number"
            min={5}
            error={errors.durationMinutes?.message}
            {...register('durationMinutes', {
              required: 'Укажите длительность',
              valueAsNumber: true,
              min: { value: 5, message: 'Минимум 5 минут' },
            })}
          />
          <Input
            label="Цена, ₽"
            type="number"
            min={0}
            error={errors.price?.message}
            {...register('price', {
              required: 'Укажите цену',
              valueAsNumber: true,
              min: { value: 0, message: 'Не может быть меньше 0' },
            })}
          />
        </div>
        <Input label="Описание" {...register('description')} />
        {mutation.isError && (
          <p className="text-sm text-integra-error">{apiErrorMessage(mutation.error)}</p>
        )}
      </form>
    </Modal>
  );
}
