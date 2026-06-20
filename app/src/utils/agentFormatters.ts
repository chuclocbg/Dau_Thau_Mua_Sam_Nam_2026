/** Converts unix-ms to UTC 'HH:MM:SS.mmm' — deterministic, SSR-safe. */
export function formatTimestamp(ts: number): string {
  const iso = new Date(ts).toISOString();
  const timePart = iso.split('T')[1] ?? '';
  return timePart.replace('Z', '');
}

/** Formats unix-ms as a full date+time string in Vietnamese locale (vi-VN). */
export function formatTimestampLocale(ts: number): string {
  return new Date(ts).toLocaleString('vi-VN');
}

/**
 * Serialises payload to compact JSON, truncated at 120 chars.
 * Returns '—' for undefined; '[non-serializable]' on circular-ref error.
 */
export function formatPayload(payload: unknown): string {
  try {
    const s = JSON.stringify(payload);
    if (!s) return '—';
    return s.length > 120 ? s.slice(0, 117) + '…' : s;
  } catch {
    return '[non-serializable]';
  }
}
