import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/authStore';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, accessToken, setAuth, logout } = useAuthStore();

  const { isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/me');
      setAuth({
        accessToken: accessToken!,
        refreshToken: useAuthStore.getState().refreshToken!,
        user: data.user,
        staff: data.staff,
        permissions: data.permissions,
      });
      return data;
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
