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
  const { isAuthenticated, accessToken, setAuth, logout } = useAuthStore();

  useEffect(() => {
    const finish = () => useAuthStore.setState({ hasHydrated: true });
    const persistApi = useAuthStore.persist;
    if (persistApi.hasHydrated()) finish();
    return persistApi.onFinishHydration(finish);
  }, []);

  const { isLoading } = useQuery({
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

  return (
    <AuthContext.Provider value={{ isLoading: isAuthenticated && isLoading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
