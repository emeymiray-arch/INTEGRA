export function calculateAge(birthDate: Date | string): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function calculateDiscount(
  basePrice: number,
  discountType: 'NONE' | 'PERCENT' | 'FIXED',
  discountValue: number,
): { discountAmount: number; finalPrice: number } {
  let discountAmount = 0;
  if (discountType === 'PERCENT') {
    discountAmount = Math.round(basePrice * (discountValue / 100) * 100) / 100;
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
