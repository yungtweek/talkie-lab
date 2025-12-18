export type PendingSubmitValues = Record<string, string>;

interface PendingSubmitEnvelopeV1 {
  v: 1;
  createdAtMs: number;
  values: PendingSubmitValues;
}

export interface TakePendingSubmitOptions {
  ttlMs: number;
  nowMs?: number;
}

export type TakePendingSubmitResult =
  | { status: 'none' }
  | { status: 'ok'; values: PendingSubmitValues }
  | { status: 'expired'; ageMs: number }
  | { status: 'invalid' };

export type SavePendingSubmitResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'unavailable' | 'unknown';
    };

export function pendingSubmitKey(conversationId: string): string {
  return `talkie.pendingSubmit:${conversationId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  if (!isPlainObject(value)) return false;
  for (const v of Object.values(value)) {
    if (typeof v !== 'string') return false;
  }
  return true;
}

function parseEnvelope(raw: string): PendingSubmitEnvelopeV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) return null;
  if (parsed.v !== 1) return null;
  if (typeof parsed.createdAtMs !== 'number') return null;
  if (!isRecordOfStrings(parsed.values)) return null;

  return {
    v: 1,
    createdAtMs: parsed.createdAtMs,
    values: parsed.values,
  };
}

export function savePendingSubmit(
  conversationId: string,
  values: PendingSubmitValues,
  nowMs: number = Date.now(),
): SavePendingSubmitResult {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'unavailable' };
  }

  const envelope: PendingSubmitEnvelopeV1 = {
    v: 1,
    createdAtMs: nowMs,
    values,
  };

  try {
    window.sessionStorage.setItem(pendingSubmitKey(conversationId), JSON.stringify(envelope));
    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException) {
      return { ok: false, reason: 'unavailable' };
    }
    return { ok: false, reason: 'unknown' };
  }
}

export function takePendingSubmit(
  conversationId: string,
  options: TakePendingSubmitOptions,
): TakePendingSubmitResult {
  if (typeof window === 'undefined') {
    return { status: 'none' };
  }

  const { ttlMs, nowMs = Date.now() } = options;
  const key = pendingSubmitKey(conversationId);

  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return { status: 'invalid' };
  }

  if (!raw) return { status: 'none' };

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore remove failures
  }

  const envelope = parseEnvelope(raw);
  if (!envelope) {
    return { status: 'invalid' };
  }

  const ageMs = nowMs - envelope.createdAtMs;
  if (ageMs > ttlMs) {
    return { status: 'expired', ageMs };
  }

  return { status: 'ok', values: envelope.values };
}
