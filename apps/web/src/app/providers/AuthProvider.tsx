import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { apiClient } from '@/shared/api/client';
import { unwrapData } from '@/shared/api/unwrap';
import { useAuthStore, type AuthStaff, type AuthUser } from '@/shared/stores/authStore';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isLoading: true,
  isAuthenticated: false,
});

type MeResponse = {
  user?: AuthUser;
  staff?: AuthStaff | null;
  permissions?: string[];
  branchId?: string;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, accessToken, user, setAuth, logout } = useAuthStore();

  useEffect(() => {
    const finish = () => useAuthStore.setState({ hasHydrated: true });
    const persistApi = useAuthStore.persist;
    if (persistApi.hasHydrated()) finish();
    const unsub = persistApi.onFinishHydration(finish);
    const timeout = window.setTimeout(finish, 800);
    return () => {
      if (typeof unsub === 'function') unsub();
      window.clearTimeout(timeout);
    };
  }, []);

  const { isLoading, isFetching, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/me');
      const payload = unwrapData<MeResponse>(res.data);
      const current = useAuthStore.getState();
      if (!payload?.user) {
        return payload;
      }
      setAuth({
        accessToken: current.accessToken!,
        refreshToken: current.refreshToken!,
        user: payload.user,
        staff: payload.staff
          ? {
              ...payload.staff,
              branchId: payload.branchId ?? payload.staff.branchId,
            }
          : current.staff,
        permissions: payload.permissions ?? current.permissions,
      });
      return payload;
    },
    enabled: isAuthenticated && !!accessToken,
    retry: false,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!accessToken) logout();
  }, [isAuthenticated, accessToken, logout]);

  const blocking = isAuthenticated && !user && (isLoading || isFetching) && !isError;

  return (
    <AuthContext.Provider value={{ isLoading: blocking, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
