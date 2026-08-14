import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token: string) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data: body } = await axios.post(`${API_BASE}/auth/refresh`, {
        refreshToken,
      });
      const payload = (body?.data ?? body) as {
        accessToken: string;
        refreshToken: string;
      };
      const newAccess = payload.accessToken;
      const newRefresh = payload.refreshToken;
      setTokens(newAccess, newRefresh);
      processQueue(newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return apiClient(original);
    } catch {
      logout();
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface DashboardStats {
  todayAppointments: number;
  todayRevenue: number;
  patientsCount: number;
  popularServices: Array<{ id: string; name: string; count: number }>;
}

export interface ActivityItem {
  id: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user?: { firstName: string; lastName: string };
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  email?: string;
  birthDate?: string;
  gender?: string;
  status: string;
  source?: string;
  allergies?: string;
  contraindications?: string;
  chronicDiseases?: string;
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
