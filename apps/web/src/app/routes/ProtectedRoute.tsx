import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAuthStore } from '@/shared/stores/authStore';

function SessionGate({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  return children;
}

export function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();
  const { isLoading } = useAuth();
  const location = useLocation();

  return (
    <SessionGate>
      {!isAuthenticated ? (
        <Navigate to="/login" state={{ from: location }} replace />
      ) : isLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <Outlet />
      )}
    </SessionGate>
  );
}

export function GuestRoute() {
  const { isAuthenticated } = useAuthStore();

  return (
    <SessionGate>
      {isAuthenticated ? <Navigate to="/" replace /> : <Outlet />}
    </SessionGate>
  );
}
