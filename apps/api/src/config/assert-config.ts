const WEAK_SECRET = /dev-(access|refresh)-secret/i;

export function assertProductionSecrets() {
  const hosted = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
  if (!hosted) return;

  const access = process.env.JWT_ACCESS_SECRET ?? '';
  const refresh = process.env.JWT_REFRESH_SECRET ?? '';
  const weak =
    !access ||
    access.length < 24 ||
    WEAK_SECRET.test(access) ||
    !refresh ||
    refresh.length < 24 ||
    WEAK_SECRET.test(refresh) ||
    access === refresh;

  if (weak) {
    console.warn(
      '[INTEGRA] JWT secrets on Vercel are missing or weak. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (different, 24+ chars).',
    );
  }
}
