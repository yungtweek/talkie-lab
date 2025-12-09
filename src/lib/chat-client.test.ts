import { describe, expect, it } from 'vitest';

import {
  defaultChatHeaders,
  ensureReadableResponse,
  extractOutputText,
  normalizeStreamError,
} from './chat-client';

describe('chat-client helpers', () => {
  it('normalizes stream errors from Error instances', () => {
    const err = new Error('boom');
    const chatErr = normalizeStreamError(err);
    expect(chatErr.type).toBe('upstream');
    expect(chatErr.message).toBe('boom');
    expect(chatErr.provider).toBe('openai');
  });

  it('normalizes stream errors with rate limit retry info', () => {
    const chatErr = normalizeStreamError({ message: 'rate', status: 429, code: 'rate_limit' });
    expect(chatErr.type).toBe('upstream');
    expect(chatErr.retry?.reason).toBe('rate_limit');
    expect(chatErr.statusCode).toBe(429);
  });

  it('falls back to unknown stream error for primitives', () => {
    const chatErr = normalizeStreamError(123 as unknown as Error);
    expect(chatErr.type).toBe('unknown');
    expect(chatErr.message).toBe('Unknown stream error');
  });

  it('extracts outputText when provided', () => {
    const text = extractOutputText({ outputText: 'hello', output: [] } as any);
    expect(text).toBe('hello');
  });

  it('extracts concatenated message parts when outputText is missing', () => {
    const text = extractOutputText({
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'output_text', text: 'hi ' },
            { type: 'output_text', text: 'there' },
          ],
        },
      ],
    } as any);

    expect(text).toBe('hi there');
  });

  it('ensures readable response and rejects on failures', async () => {
    const ok = new Response('ok');
    await expect(ensureReadableResponse(ok)).resolves.toBe(ok);

    const noBody = { ok: true, status: 200, body: undefined } as unknown as Response;
    await expect(ensureReadableResponse(noBody)).rejects.toThrow('ReadableStream body is missing');

    const bad = new Response('bad', { status: 500 });
    await expect(ensureReadableResponse(bad)).rejects.toThrow('Request failed with status 500');
  });

  it('exports default JSON headers', () => {
    expect(defaultChatHeaders['Content-Type']).toBe('application/json');
  });
});
