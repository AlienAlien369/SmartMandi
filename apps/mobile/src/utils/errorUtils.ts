/**
 * Extracts a human-readable error message from any API error.
 * NestJS class-validator returns arrays; this handles both string and array.
 */
export function extractApiError(e: any): string {
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('\n');
  if (typeof msg === 'string') return msg;
  if (e?.message) return e.message;
  return 'An unexpected error occurred';
}
