import { describe, expect, it, beforeEach } from 'vitest';

import {
  pendingSubmitKey,
  savePendingSubmit,
  takePendingSubmit,
  type PendingSubmitValues,
} from '@/lib/pending-submit';

class MemorySessionStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

function installWindowWithSessionStorage(storage: MemorySessionStorage) {
  (globalThis as unknown as { window: unknown }).window = {
    sessionStorage: storage,
  };
}

describe('pending-submit', () => {
  const conversationId = 'conv_123';
  let storage: MemorySessionStorage;

  beforeEach(() => {
    storage = new MemorySessionStorage();
    installWindowWithSessionStorage(storage);
  });

  it('saves and takes the pending submit (and removes it)', () => {
    const values: PendingSubmitValues = { input: 'hello', mode: 'auto' };
    const saveResult = savePendingSubmit(conversationId, values, 1000);
    expect(saveResult).toEqual({ ok: true });

    const takeResult = takePendingSubmit(conversationId, { ttlMs: 30_000, nowMs: 1001 });
    expect(takeResult).toEqual({ status: 'ok', values });

    expect(storage.getItem(pendingSubmitKey(conversationId))).toBeNull();
  });

  it('returns expired when over TTL (and removes it)', () => {
    const values: PendingSubmitValues = { input: 'hi' };
    savePendingSubmit(conversationId, values, 0);

    const takeResult = takePendingSubmit(conversationId, { ttlMs: 30_000, nowMs: 31_000 });
    expect(takeResult.status).toBe('expired');
    expect(storage.getItem(pendingSubmitKey(conversationId))).toBeNull();
  });

  it('returns invalid for malformed JSON (and removes it)', () => {
    storage.setItem(pendingSubmitKey(conversationId), '{not-json');

    const takeResult = takePendingSubmit(conversationId, { ttlMs: 30_000, nowMs: 0 });
    expect(takeResult).toEqual({ status: 'invalid' });
    expect(storage.getItem(pendingSubmitKey(conversationId))).toBeNull();
  });

  it('returns none when nothing is saved', () => {
    const takeResult = takePendingSubmit(conversationId, { ttlMs: 30_000, nowMs: 0 });
    expect(takeResult).toEqual({ status: 'none' });
  });
});

