export function calculateAge(birthDate: Date | string): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function clampPage(page?: number, fallback = 1): number {
  const n = Number(page);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function clampLimit(limit?: number, fallback = 20, max = 50): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as { data?: unknown; items?: unknown };
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
}

export interface SearchHit {
  id: string;
  type: 'patient' | 'staff' | 'service';
  title: string;
  subtitle?: string;
}

export function flattenSearch(data: unknown): SearchHit[] {
  if (!data || typeof data !== 'object') return [];
  const record = data as {
    results?: unknown;
    patients?: Array<{ id: string; firstName: string; lastName: string; phone?: string | null }>;
    staff?: Array<{
      id: string;
      firstName: string;
      lastName: string;
      specialization?: string | null;
    }>;
    services?: Array<{ id: string; name: string; durationMinutes?: number }>;
  };
  if (Array.isArray(record.results)) {
    return record.results as SearchHit[];
  }
  return [
    ...(record.patients ?? []).map((patient) => ({
      id: patient.id,
      type: 'patient' as const,
      title: `${patient.lastName} ${patient.firstName}`.trim(),
      subtitle: patient.phone ?? undefined,
    })),
    ...(record.staff ?? []).map((member) => ({
      id: member.id,
      type: 'staff' as const,
      title: `${member.lastName} ${member.firstName}`.trim(),
      subtitle: member.specialization ?? undefined,
    })),
    ...(record.services ?? []).map((service) => ({
      id: service.id,
      type: 'service' as const,
      title: service.name,
      subtitle: service.durationMinutes ? `${service.durationMinutes} мин` : undefined,
    })),
  ];
}

export function calculateDiscount(
  basePrice: number,
  discountType: 'NONE' | 'PERCENT' | 'FIXED',
  discountValue: number,
): { discountAmount: number; finalPrice: number } {
  let discountAmount = 0;
  if (discountType === 'PERCENT') {
    const percent = Math.min(Math.max(discountValue, 0), 100);
    discountAmount = Math.round(basePrice * (percent / 100) * 100) / 100;
  } else if (discountType === 'FIXED') {
    discountAmount = Math.min(discountValue, basePrice);
  }
  const finalPrice = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);
  return { discountAmount, finalPrice };
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(amount);
}
