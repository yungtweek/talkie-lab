import { type ResponsesCreateParams } from '@/lib/ai/llm/types';

export type BuildRequestBodyResult = Record<string, unknown> & {
  stream?: boolean;
  conversationId: string;
};

export type BuildRequestBody<TMessage = unknown> = (params: {
  input: string;
  messages: TMessage[];
  conversationId: string;
}) => BuildRequestBodyResult;

export interface NormalizedRequestBody {
  body: BuildRequestBodyResult;
  stream: boolean;
}

export type ActionRequestPayload = ResponsesCreateParams & Record<string, unknown>;

export const normalizeRequestBody = (
  body: BuildRequestBodyResult,
  streamOption?: boolean,
): NormalizedRequestBody => {
  const stream = streamOption ?? body.stream !== false;
  return { body: { ...body, stream }, stream };
};

export const toActionRequestPayload = (body: BuildRequestBodyResult): ActionRequestPayload => {
  const { conversationId: _conversationId, ...rest } = body;
  return rest as ActionRequestPayload;
};
