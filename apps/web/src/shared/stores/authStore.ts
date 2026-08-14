import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  isActive: boolean;
}

export interface AuthStaff {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  avatarUrl?: string;
  specialization?: string;
  branchId?: string;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  staff: AuthStaff | null;
  permissions: string[];
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    staff?: AuthStaff | null;
    permissions?: string[];
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      staff: null,
      permissions: [],
      isAuthenticated: false,
      hasHydrated: true,
      setAuth: ({ accessToken, refreshToken, user, staff, permissions }) =>
        set({
          accessToken,
          refreshToken,
          user,
          staff: staff ?? null,
          permissions: permissions ?? [],
          isAuthenticated: true,
        }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          staff: null,
          permissions: [],
          isAuthenticated: false,
        }),
    }),
    {
      name: 'integra-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        staff: state.staff,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          useAuthStore.setState({
            hasHydrated: true,
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
            user: null,
            staff: null,
            permissions: [],
          });
          return;
        }
        useAuthStore.setState({ hasHydrated: true });
      },
    },
  ),
);
