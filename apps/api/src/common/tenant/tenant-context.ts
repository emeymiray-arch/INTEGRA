import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantStore {
  organizationId: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(organizationId: string, fn: () => T): T {
  return storage.run({ organizationId }, fn);
}

export function getTenantId(): string | undefined {
  return storage.getStore()?.organizationId;
}
