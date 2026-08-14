import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function flushQueue(error: unknown, token?: string) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error || !token) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
}

function isPublicAuthRequest(url?: string) {
  return /\/auth\/(login|register|refresh)\b/.test(url ?? '');
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !isPublicAuthRequest(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const keys = Object.keys(body as object);
      if (keys.includes('data') && keys.every((key) => key === 'data' || key === 'error')) {
        response.data = (body as { data: unknown }).data;
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status !== 401 ||
      original._retry ||
      isPublicAuthRequest(original.url)
    ) {
      return Promise.reject(error);
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data: body } = await axios.post(
        `${API_BASE}/auth/refresh`,
        { refreshToken },
        { timeout: 8000 },
      );
      const payload = (body?.data ?? body) as {
        accessToken: string;
        refreshToken: string;
      };
      const newAccess = payload.accessToken;
      const newRefresh = payload.refreshToken;
      if (!newAccess || !newRefresh) {
        throw new Error('Refresh payload missing tokens');
      }
      setTokens(newAccess, newRefresh);
      flushQueue(null, newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return apiClient(original);
    } catch (refreshError) {
      flushQueue(refreshError);
      logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardStats {
  todayAppointments: number;
  todayRevenue: number;
  patientsCount: number;
  monthRevenue?: number;
  pendingInvoices?: number;
  popularServices: Array<{ id: string; name: string; count: number }>;
}

export interface ActivityItem {
  id: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user?: { email?: string; firstName?: string; lastName?: string };
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  birthDate?: string;
  gender?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  staffId: string;
  serviceId: string;
  branchId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  finalPrice: number;
  status: string;
  notes?: string;
  patient?: { firstName: string; lastName: string };
  staff?: { firstName: string; lastName: string };
  service?: { name: string };
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  category?: { name: string };
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  specialization?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  roles?: Array<{ code: string; name: string }>;
}

export interface Debt {
  id: string;
  debtorName: string;
  amount: number;
  note?: string | null;
  settledAt?: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  patient?: { firstName: string; lastName: string };
  issuedAt?: string;
}

export interface SearchResult {
  id: string;
  type: 'patient' | 'appointment' | 'service' | 'staff';
  title: string;
  subtitle?: string;
}
