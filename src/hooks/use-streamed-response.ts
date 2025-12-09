import { useCallback } from 'react';

import { defaultChatHeaders, ensureReadableResponse } from '@/lib/chat-client';

export interface StreamRequestOptions {
  url: string;
  body: unknown;
  controller: AbortController;
  headers?: HeadersInit;
  method?: 'POST' | 'GET';
  onLine: (line: string) => void;
}

/**
 * Helper hook to consume NDJSON streaming responses.
 * Responsibilities: issue fetch, decode chunks, split by newline, and invoke `onLine` per chunk.
 */
export function useStreamedResponse() {
  const start = useCallback(async (options: StreamRequestOptions) => {
    const { url, body, controller, headers, method = 'POST', onLine } = options;

    const response = await ensureReadableResponse(
      await fetch(url, {
        method,
        headers: headers ?? defaultChatHeaders,
        body: method === 'POST' ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      }),
    );

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (controller.signal.aborted) break;

        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          onLine(line);
        }

        if (done) break;
      }

      if (buffer.trim()) {
        onLine(buffer);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore release failures
      }
    }
  }, []);

  return { start };
}
