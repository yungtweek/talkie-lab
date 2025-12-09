import { describe, expect, it } from 'vitest';

import { normalizeRequestBody } from './payloads';

describe('payload helpers', () => {
  it('respects explicit stream option override', () => {
    const body = { conversationId: 'c1', stream: true };
    const normalized = normalizeRequestBody(body, false);
    expect(normalized.stream).toBe(false);
    expect(normalized.body.stream).toBe(false);
  });

  it('defaults to stream true when body.stream is undefined', () => {
    const body = { conversationId: 'c1' };
    const normalized = normalizeRequestBody(body);
    expect(normalized.stream).toBe(true);
    expect(normalized.body.stream).toBe(true);
  });

  it('respects body.stream false when no override is provided', () => {
    const body = { conversationId: 'c1', stream: false };
    const normalized = normalizeRequestBody(body);
    expect(normalized.stream).toBe(false);
    expect(normalized.body.stream).toBe(false);
  });
});
