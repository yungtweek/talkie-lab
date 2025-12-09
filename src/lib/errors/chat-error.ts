// src/lib/errors/chat-error.ts

// =======================
// TODO: Core error categories
// =======================
export type ChatErrorType =
  | 'network' // TODO: Fetch failure, DNS issues, disconnects, timeout
  | 'upstream' // TODO: External provider errors (OpenAI/vLLM/etc.)
  | 'rate_limit' // TODO: 429 or throughput limit
  | 'validation' // TODO: Model config, parameters, or prompt issues
  | 'aborted' // TODO: User aborted or stream terminated
  | 'internal' // TODO: Server-side logic error
  | 'unknown'; // TODO: Final fallback

// =======================
// TODO: Shared error shape for all providers
// =======================
export interface ChatError {
  type: ChatErrorType;
  message: string; // TODO: Message for UI display
  statusCode?: number; // TODO: HTTP status code when available
  provider?: 'openai' | 'gateway' | 'local' | 'unknown';
  raw?: unknown; // TODO: Diagnostics/logging only; not for UI
  stack?: string | undefined;
  retry?: {
    model?: string;
    previousResponseId?: string;
    reason?: string;
  };
}

// =======================
// TODO: Helper to construct ChatError instances
// =======================
export function createChatError(
  type: ChatErrorType,
  message: string,
  opts?: Omit<ChatError, 'type' | 'message'>,
): ChatError {
  return {
    type,
    message,
    ...opts,
    provider: opts?.provider ?? 'unknown',
    retry: opts?.retry,
  };
}

interface ResponseLikeError {
  status?: unknown;
  statusText?: unknown;
}

function isResponseLikeError(error: unknown): error is { status: number; statusText: string } {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as ResponseLikeError;

  return (
    typeof candidate.status === 'number' &&
    Number.isFinite(candidate.status) &&
    candidate.status >= 100 &&
    typeof candidate.statusText === 'string'
  );
}

// =======================
// TODO: Normalize upstream/fetch errors to ChatError
// =======================
export function normalizeError(error: unknown): ChatError {
  // AbortError or stream terminated
  if (
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError') ||
    String(error).includes('terminated')
  ) {
    return createChatError('aborted', 'Request was aborted.', { raw: error });
  }

  // TODO: HTTP-response-based errors (OpenAI, gateway, etc.)
  const responseError = isResponseLikeError(error) ? error : null;

  if (responseError) {
    if (responseError.status === 429) {
      return createChatError('rate_limit', 'Too many requests. Please retry shortly.', {
        statusCode: responseError.status,
        provider: 'openai',
        raw: responseError,
      });
    }

    if (responseError.status >= 500) {
      return createChatError('upstream', 'LLM provider returned an error.', {
        statusCode: responseError.status,
        provider: 'openai',
        raw: responseError,
      });
    }

    return createChatError('validation', `Request was rejected. (${responseError.status})`, {
      statusCode: responseError.status,
      provider: 'openai',
      raw: responseError,
    });
  }

  // TODO: Final fallback
  return createChatError('unknown', 'An unknown error occurred.', {
    raw: error,
  });
}
