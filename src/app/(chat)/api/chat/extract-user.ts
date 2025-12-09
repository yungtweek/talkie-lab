import type { ResponsesCreateParams } from '@/lib/ai/llm/types';

export function extractLatestUserContent(input: ResponsesCreateParams['input']): string {
  for (let i = input.length - 1; i >= 0; i -= 1) {
    const item = input[i] as { role?: unknown; content?: unknown };
    if (item && item.role === 'user' && typeof item.content === 'string') {
      return item.content;
    }
  }
  return '';
}
