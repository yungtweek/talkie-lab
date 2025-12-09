import {
  type LLMOutputMessage,
  type LLMOutputTextContentPart,
  type LLMResponseObject,
  type LLMStreamErrorPayload,
} from '@/lib/ai/llm/types';
import { type ChatError, createChatError } from '@/lib/errors/chat-error';

export const defaultChatHeaders = {
  'Content-Type': 'application/json',
} as const;

export const ensureReadableResponse = async (response: Response): Promise<Response> => {
  if (!response.ok) {
    return Promise.reject(new Error(`Request failed with status ${response.status}`));
  }

  if (!response.body) {
    return Promise.reject(new Error('ReadableStream body is missing'));
  }

  return Promise.resolve(response);
};

export const normalizeStreamError = (payload: LLMStreamErrorPayload): ChatError => {
  if (payload instanceof Error) {
    return createChatError('upstream', payload.message, {
      provider: 'openai',
      raw: payload,
    });
  }

  if (payload && typeof payload === 'object') {
    const message =
      'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : 'Unknown upstream error';
    const statusCode =
      'status' in payload && typeof payload.status === 'number' ? payload.status : undefined;
    const code = 'code' in payload && typeof payload.code === 'string' ? payload.code : undefined;

    return createChatError('upstream', message, {
      provider: 'openai',
      statusCode,
      raw: payload,
      retry: code === 'rate_limit' || statusCode === 429 ? { reason: 'rate_limit' } : undefined,
    });
  }

  return createChatError('unknown', 'Unknown stream error', {
    provider: 'openai',
    raw: payload,
  });
};

export const extractOutputText = (response: LLMResponseObject): string => {
  if (typeof response.outputText === 'string' && response.outputText.length > 0) {
    return response.outputText;
  }

  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (!item || item.type !== 'message') continue;
    const msg = item as LLMOutputMessage;
    for (const contentPart of msg.content ?? []) {
      const textPart = contentPart as LLMOutputTextContentPart | undefined;
      if (textPart?.type === 'output_text') {
        parts.push(textPart.text);
      }
    }
  }

  return parts.join('');
};
