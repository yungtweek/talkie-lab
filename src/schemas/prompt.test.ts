import { describe, expect, it } from 'vitest';

import { basePromptSchema } from './prompt';

const basePayload = {
  key: 'valid_key',
  description: undefined,
  tags: [],
  content: 'content',
};

const parseName = (name: string) =>
  basePromptSchema.parse({
    ...basePayload,
    name,
  });

describe('basePromptSchema name validation', () => {
  it('trims leading and trailing whitespace before validating', () => {
    const result = parseName('  My Prompt  ');
    expect(result.name).toBe('My Prompt');
  });

  it('allows letters, numbers, spaces, hyphens, and underscores after the first character', () => {
    const validNames = [
      'Prompt',
      'Prompt 2',
      'Prompt_Name',
      'Prompt-Name',
      'Prompt name-hybrid_42',
    ];

    for (const name of validNames) {
      expect(parseName(name).name).toBe(name);
    }
  });

  it('requires the name to start with a letter or underscore', () => {
    const invalidNames = ['1prompt', '-prompt', '#prompt'];

    for (const name of invalidNames) {
      expect(() => parseName(name)).toThrow();
    }
  });

  it('rejects characters outside the allowed set', () => {
    const invalidNames = ['Prompt!', 'Prompt$', 'Prompt@Name'];

    for (const name of invalidNames) {
      expect(() => parseName(name)).toThrow();
    }
  });
});
