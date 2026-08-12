import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@integra/shared';
import { Button, Card, Input } from '@integra/ui';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginInput) => {
      const res = await apiClient.post('/auth/login', data);
      return res.data;
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

  return (
    <Card padding="lg" className="shadow-md">
      <div className="mb-8 lg:hidden">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
          I
        </div>
        <h1 className="mt-4 text-2xl font-bold text-integra-gray-900">INTEGRA</h1>
        <p className="text-sm text-integra-gray-600">Вход в систему</p>
      </div>

      <h2 className="hidden text-2xl font-bold text-integra-gray-900 lg:block">Вход</h2>
      <p className="mt-1 hidden text-sm text-integra-gray-600 lg:block">
        Введите данные для доступа к CRM
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={handleSubmit((data) => loginMutation.mutate(data))}
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {loginMutation.isError && (
          <p className="rounded-lg bg-integra-error/10 px-3 py-2 text-sm text-integra-error">
            Неверный email или пароль
          </p>
        )}

        <Button type="submit" className="w-full" loading={loginMutation.isPending}>
          Войти
        </Button>
      </form>
    </Card>
  );
}
