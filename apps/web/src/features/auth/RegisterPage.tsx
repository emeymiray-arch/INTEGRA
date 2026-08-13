import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { registerSchema, type RegisterInput } from '@integra/shared';
import { Button, Card, Input } from '@integra/ui';
import { apiClient } from '@/shared/api/client';
import { unwrapData } from '@/shared/api/unwrap';
import { useAuthStore } from '@/shared/stores/authStore';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; isActive: boolean };
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    avatarUrl?: string;
    specialization?: string;
  };
  permissions: string[];
};

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      middleName: '',
      phone: '',
      organizationName: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      const { confirmPassword: _confirm, ...payload } = data;
      const res = await apiClient.post('/auth/register', payload);
      return unwrapData<AuthResponse>(res.data);
    },
    onSuccess: (data) => {
      setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
        staff: data.staff,
        permissions: data.permissions,
      });
      navigate('/');
    },
  });

  const errorMessage =
    registerMutation.error instanceof AxiosError
      ? !registerMutation.error.response
        ? 'Сервер API недоступен. Сейчас на Vercel задеплоен только фронт — нужен NestJS API и PostgreSQL.'
        : (registerMutation.error.response?.data as { message?: string | string[] })?.message
      : null;
  const errorText = Array.isArray(errorMessage)
    ? errorMessage.join(', ')
    : errorMessage || 'Не удалось зарегистрироваться';

  return (
    <Card padding="lg" className="shadow-md">
      <div className="mb-6 lg:hidden">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
          I
        </div>
        <h1 className="mt-4 text-2xl font-bold text-integra-gray-900">INTEGRA</h1>
      </div>

      <h2 className="text-2xl font-bold text-integra-gray-900">Регистрация</h2>
      <p className="mt-1 text-sm text-integra-gray-600">
        Создайте медицинский центр и аккаунт администратора
      </p>

      <form
        className="mt-6 space-y-3"
        onSubmit={handleSubmit((data) => registerMutation.mutate(data))}
      >
        <Input
          label="Название центра"
          placeholder="INTEGRA"
          error={errors.organizationName?.message}
          {...register('organizationName')}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Фамилия"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
          <Input
            label="Имя"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
        </div>

        <Input
          label="Отчество"
          error={errors.middleName?.message}
          {...register('middleName')}
        />

        <Input
          label="Телефон"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Пароль"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Повторите пароль"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {registerMutation.isError && (
          <p className="rounded-lg bg-integra-error/10 px-3 py-2 text-sm text-integra-error">
            {errorText}
          </p>
        )}

        <Button type="submit" className="w-full" loading={registerMutation.isPending}>
          Создать аккаунт
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-integra-gray-600">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="font-medium text-primary hover:text-primary-light">
          Войти
        </Link>
      </p>
    </Card>
  );
}
