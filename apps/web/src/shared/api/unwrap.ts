/** Unwrap Nest TransformInterceptor `{ data: T }` payloads. */
export function unwrapData<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as { data: unknown }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
