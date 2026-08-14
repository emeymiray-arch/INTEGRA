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
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      const res = await apiClient.post('/auth/register', data);
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

  const errorText = (() => {
    if (!(registerMutation.error instanceof AxiosError)) {
      return 'Не удалось зарегистрироваться';
    }

    const err = registerMutation.error;
    if (!err.response) {
      return 'Сервер API недоступен. Проверьте деплой и DATABASE_URL в Vercel.';
    }

    const status = err.response.status;
    const raw = err.response.data;
    const asText = typeof raw === 'string' ? raw : '';

    if (
      status === 401 ||
      status === 403 ||
      asText.includes('vercel.com/sso') ||
      asText.includes('Authentication Required')
    ) {
      return 'Сайт закрыт Vercel Authentication (SSO). Отключите Deployment Protection в настройках проекта Vercel.';
    }

    if (status === 503) {
      const nested =
        typeof raw === 'object' && raw && 'error' in raw
          ? (raw as { error?: { message?: string } }).error?.message
          : undefined;
      return nested || 'API не готов: проверьте DATABASE_URL.';
    }

    const message =
      typeof raw === 'object' && raw && 'message' in raw
        ? (raw as { message?: string | string[] }).message
        : typeof raw === 'object' && raw && 'error' in raw
          ? (raw as { error?: { message?: string } | string }).error
          : undefined;

    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
    if (message && typeof message === 'object' && 'message' in message) {
      return String((message as { message?: string }).message);
    }

    return `Ошибка регистрации (${status})`;
  })();

  return (
    <Card padding="lg" className="shadow-md">
      <div className="mb-6 lg:hidden">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
          I
        </div>
        <h1 className="mt-4 text-2xl font-bold text-integra-gray-900">INTEGRA</h1>
      </div>

      <h2 className="text-2xl font-bold text-integra-gray-900">Регистрация</h2>
      <p className="mt-1 text-sm text-integra-gray-600">Email и пароль — этого достаточно</p>

      <form
        className="mt-6 space-y-3"
        onSubmit={handleSubmit((data) => registerMutation.mutate(data))}
      >
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
