const WEAK_SECRET = /dev-(access|refresh)-secret/i;

export function assertProductionSecrets() {
  const hosted = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
  if (!hosted) return;

  const access = process.env.JWT_ACCESS_SECRET ?? '';
  const refresh = process.env.JWT_REFRESH_SECRET ?? '';

  if (!access || access.length < 24 || WEAK_SECRET.test(access)) {
    throw new Error('JWT_ACCESS_SECRET must be a strong secret in production');
  }
  if (!refresh || refresh.length < 24 || WEAK_SECRET.test(refresh)) {
    throw new Error('JWT_REFRESH_SECRET must be a strong secret in production');
  }
  if (access === refresh) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
}
