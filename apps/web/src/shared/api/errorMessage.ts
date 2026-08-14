import { AxiosError } from 'axios';

export function apiErrorMessage(error: unknown, fallback = 'Не удалось сохранить') {
  if (!(error instanceof AxiosError)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }
  const raw = error.response?.data;
  const message =
    typeof raw === 'object' && raw && 'message' in raw
      ? (raw as { message?: string | string[] }).message
      : typeof raw === 'object' && raw && 'error' in raw
        ? (raw as { error?: { message?: string } | string }).error
        : undefined;

  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(', ');
  if (message && typeof message === 'object' && 'message' in message) {
    return String((message as { message?: string }).message);
  }
  if (error.response?.status) return `${fallback} (${error.response.status})`;
  return fallback;
}
