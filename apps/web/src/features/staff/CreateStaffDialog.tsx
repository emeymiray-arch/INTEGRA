import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleCode } from '@integra/shared';
import { Button, Input, Modal } from '@integra/ui';
import { apiClient } from '@/shared/api/client';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { SelectField } from '@/shared/ui/SelectField';

interface StaffForm {
  lastName: string;
  firstName: string;
  email: string;
  password: string;
  phone?: string;
  specialization?: string;
  branchId: string;
  roleCode: RoleCode;
}

interface Branch {
  id: string;
  name: string;
}

interface CreateStaffDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateStaffDialog({ open, onClose }: CreateStaffDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<StaffForm>({
    defaultValues: {
      lastName: '',
      firstName: '',
      email: '',
      password: '',
      phone: '',
      specialization: '',
      branchId: '',
      roleCode: RoleCode.DOCTOR,
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await apiClient.get('/branches');
      return (Array.isArray(data) ? data : data?.data ?? []) as Branch[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (branches[0]?.id) setValue('branchId', branches[0].id);
  }, [branches, setValue]);

  const mutation = useMutation({
    mutationFn: async (values: StaffForm) => {
      const { data } = await apiClient.post('/staff', {
        lastName: values.lastName.trim(),
        firstName: values.firstName.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        phone: values.phone?.trim() || undefined,
        specialization: values.specialization?.trim() || undefined,
        branchId: values.branchId,
        roleCodes: [values.roleCode],
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      reset();
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый сотрудник"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="create-staff-form" loading={mutation.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        id="create-staff-form"
        className="space-y-3"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <Input
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register('email', { required: 'Укажите email' })}
        />
        <Input
          label="Пароль"
          type="password"
          error={errors.password?.message}
          {...register('password', {
            required: 'Укажите пароль',
            minLength: { value: 6, message: 'Минимум 6 символов' },
          })}
        />
        <Input label="Телефон" type="tel" {...register('phone')} />
        <Input label="Специализация" {...register('specialization')} />
        <SelectField
          label="Филиал"
          error={errors.branchId?.message}
          {...register('branchId', { required: 'Выберите филиал' })}
        >
          <option value="">Выберите филиал</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Роль" {...register('roleCode')}>
          <option value={RoleCode.DOCTOR}>Врач</option>
          <option value={RoleCode.MASSAGE_THERAPIST}>Массажист</option>
          <option value={RoleCode.MANAGER}>Менеджер</option>
          <option value={RoleCode.ADMIN}>Администратор</option>
          <option value={RoleCode.FINANCE}>Финансы</option>
        </SelectField>
        {mutation.isError && (
          <p className="text-sm text-integra-error">{apiErrorMessage(mutation.error)}</p>
        )}
      </form>
    </Modal>
  );
}
