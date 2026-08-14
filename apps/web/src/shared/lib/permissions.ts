import { PERMISSIONS } from '@integra/shared';
import { useAuthStore } from '@/shared/stores/authStore';

export function useCan(permission: string) {
  return useAuthStore((state) => state.permissions.includes(permission));
}

export { PERMISSIONS };
