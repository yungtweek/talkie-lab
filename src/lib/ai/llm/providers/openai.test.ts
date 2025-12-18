import { describe, expect, it, vi } from 'vitest';

import { openAIProvider } from './openai';

import type { InputItem } from '@/lib/ai/llm/types';

describe('openAIProvider', () => {
  it('strips unsupported status fields from input items', async () => {
    process.env.LLM_BASE_URL = 'https://example.test';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_PROVIDER = 'openai-chat';

    const input: InputItem[] = [
      { role: 'user', content: 'hello', status: 'completed' },
      {
        type: 'function_call',
        callId: 'call_1',
        name: 'calculator',
        arguments: '{"expression":"1+1"}',
        status: 'completed',
      },
      {
        type: 'function_call_output',
        callId: 'call_1',
        output: '2',
        status: 'completed',
      },
    ];

    let capturedBody = '';
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ id: 'resp_1', created_at: 0, output: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    await openAIProvider.createTextResponse({
      model: 'openai:gpt-4.1',
      input,
      stream: false,
    });

    const parsed = JSON.parse(capturedBody) as { input?: unknown[] };
    expect(Array.isArray(parsed.input)).toBe(true);

    const items = parsed.input as Array<Record<string, unknown>>;
    expect(items.some(item => 'status' in item)).toBe(false);
  });
});
