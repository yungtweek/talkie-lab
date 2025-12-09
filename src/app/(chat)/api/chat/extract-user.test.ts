import { describe, expect, it } from 'vitest';

import { extractLatestUserContent } from './extract-user';

import type { InputItem } from '@/lib/ai/llm/types';

describe('extractLatestUserContent', () => {
  it('returns the latest user content when present', () => {
    const input: InputItem[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'first user' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second user' },
    ];

    const result = extractLatestUserContent(input);
    expect(result).toBe('second user');
  });

  it('returns empty string when no user message exists', () => {
    const input: InputItem[] = [
      { role: 'system', content: 'sys' },
      { role: 'assistant', content: 'reply' },
    ];

    const result = extractLatestUserContent(input);
    expect(result).toBe('');
  });
});
