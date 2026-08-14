import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal } from '@integra/ui';
import { apiClient } from '@/shared/api/client';
import { apiErrorMessage } from '@/shared/api/errorMessage';

interface DebtForm {
  debtorName: string;
  amount: number;
  note?: string;
}

interface CreateDebtDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateDebtDialog({ open, onClose }: CreateDebtDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DebtForm>({
    defaultValues: { debtorName: '', amount: undefined as unknown as number, note: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: DebtForm) => {
      const { data } = await apiClient.post('/finance/debts', {
        debtorName: values.debtorName.trim(),
        amount: Number(values.amount),
        note: values.note?.trim() || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      reset();
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый долг"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="create-debt-form" loading={mutation.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        id="create-debt-form"
        className="space-y-3"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <Input
          label="Должник"
          error={errors.debtorName?.message}
          {...register('debtorName', { required: 'Укажите должника' })}
        />
        <Input
          label="Сумма долга, ₽"
          type="number"
          min={0.01}
          step="0.01"
          error={errors.amount?.message}
          {...register('amount', {
            required: 'Укажите сумму',
            valueAsNumber: true,
            min: { value: 0.01, message: 'Сумма должна быть больше 0' },
          })}
        />
        <Input label="Примечание" {...register('note')} />
        {mutation.isError && (
          <p className="text-sm text-integra-error">{apiErrorMessage(mutation.error)}</p>
        )}
      </form>
    </Modal>
  );
}
