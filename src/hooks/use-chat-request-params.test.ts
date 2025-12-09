import { describe, expect, it } from 'vitest';

import { type ChatMessage } from '@/hooks/use-chat';
import { buildChatRequestBody, type ChatRequestContext } from '@/hooks/use-chat-request-params';

const baseContext: ChatRequestContext = {
  conversationId: 'conv-1',
  modelName: 'gpt-4.1',
  reasoningEfforts: ['low', 'medium', 'high'],
  stream: true,
  chatMode: 'auto',
  systemPrompt: 'system',
  tools: [],
  reasoningEffort: 'medium',
  temperature: 0.5,
  topP: 0.8,
  maxOutputTokens: 512,
  modelMaxTokens: 256,
  supportsTemperature: true,
  supportsTopP: true,
};

const message = (id: string, role: ChatMessage['role'], content: string): ChatMessage => ({
  id,
  role,
  content,
});

describe('buildChatRequestBody', () => {
  it('collapses consecutive user messages, keeps the last 5, and appends the current input', () => {
    const messages: ChatMessage[] = [
      message('1', 'user', 'first'),
      message('2', 'user', 'second'), // should replace 'first'
      message('3', 'assistant', 'reply A'),
      message('4', 'user', 'third'),
      message('5', 'assistant', 'reply B'),
      message('6', 'user', 'fourth'),
    ];

    const body = buildChatRequestBody(
      { input: 'current', messages, conversationId: 'conv-1' },
      baseContext,
    );

    expect(body.input).toEqual([
      { role: 'assistant', content: 'reply A' },
      { role: 'user', content: 'third' },
      { role: 'assistant', content: 'reply B' },
      { role: 'user', content: 'fourth' },
      { role: 'user', content: 'current' },
    ]);
  });

  it('attaches reasoning effort when supported and clamps maxOutputTokens to the model cap', () => {
    const body = buildChatRequestBody(
      { input: 'hi', messages: [], conversationId: 'conv-1' },
      baseContext,
    );

    expect(body.reasoning).toEqual({ effort: 'medium' });
    expect(body.maxOutputTokens).toBe(256);
    expect(body.model).toBe('gpt-4.1');
  });

  it('omits reasoning when the model does not support it', () => {
    const body = buildChatRequestBody(
      { input: 'hi', messages: [], conversationId: 'conv-1' },
      { ...baseContext, reasoningEfforts: [] },
    );

    expect(body.reasoning).toBeUndefined();
  });

  it('includes prompt metadata snapshot and system prompt text', () => {
    const body = buildChatRequestBody(
      { input: 'hello', messages: [], conversationId: 'conv-1' },
      {
        ...baseContext,
        systemPrompt: 'system-text',
        promptMetadataId: 'meta-123',
        promptId: 'prompt-456',
      },
    );

    expect(body.systemPrompt).toBe('system-text');
    expect(body.systemPromptText).toBe('system-text');
    expect(body.promptMetadataId).toBe('meta-123');
    expect(body.promptId).toBe('prompt-456');
  });
});
