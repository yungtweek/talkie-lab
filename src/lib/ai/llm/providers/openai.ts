import { getEncoding } from 'js-tiktoken';

import { type AgentToolSchema } from '@/lib/ai/agents/types';
import { type LLMProvider } from '@/lib/ai/llm/provider';
import {
  type LLMStreamEvent,
  LLMStreamEventType,
  type ResponsesCreateParams,
  type InputItem,
  type InputMessage,
  type LLMResponseOutputItem,
  type LLMOutputMessage,
  type LLMOutputTextContentPart,
  type LLMStreamErrorPayload,
  type LLMTokenUsageInputDetails,
  type LLMTokenUsageOutputDetails,
  type LLMTokenUsage,
  type LLMResponseObject,
  type LLMResponseStatus,
  type LLMIncompleteDetails,
  type FunctionToolCallOutput,
  type FunctionToolCall,
  type LLMError,
  type Reasoning,
  type LLMResponseReasoningPayload,
} from '@/lib/ai/llm/types';

const OPENAI_PROVIDER_LABEL = 'OpenAI';

interface OpenAIStreamMessage {
  type?: string;
  delta?: unknown;
  response?: unknown;
  item?: unknown;
  error?: unknown;
  usage?: unknown;
  [key: string]: unknown;
}

type OpenAIFunctionToolCall = Omit<FunctionToolCall, 'callId'> & { call_id: string };
type OpenAIFunctionToolCallOutput = Omit<FunctionToolCallOutput, 'callId'> & { call_id: string };
type OpenAIReasoning = Omit<Reasoning, 'encryptedContent'> & { encrypted_content?: string };

type OpenAIInputItem =
  | InputMessage
  | OpenAIFunctionToolCall
  | OpenAIFunctionToolCallOutput
  | OpenAIReasoning;

type OpenAIResponsesPayload = Omit<
  ResponsesCreateParams,
  'toolChoice' | 'systemPrompt' | 'input' | 'mode' | 'topP' | 'maxOutputTokens'
> & {
  input: OpenAIInputItem[];
  tool_choice?: 'auto' | 'first' | 'last';
  top_p?: number;
  max_output_tokens?: number;
  stream?: boolean;
};

type StreamPayload = OpenAIResponsesPayload & { stream: true };
type NonStreamPayload = OpenAIResponsesPayload & { stream?: false | undefined };

function toOpenAIInputItem(item: InputItem): OpenAIInputItem {
  if (item.type === 'function_call') {
    const { callId, ...rest } = item;
    return {
      ...rest,
      call_id: callId,
    };
  }
  if (item.type === 'function_call_output') {
    const { callId, ...rest } = item;
    return {
      ...rest,
      call_id: callId,
    };
  }
  if (item.type === 'reasoning') {
    const { encryptedContent, ...rest } = item;
    return {
      ...rest,
      ...(encryptedContent ? { encrypted_content: encryptedContent } : {}),
    };
  }
  return item;
}

// NOTE:
// - OpenAI Responses API에는 `mode` 필드가 없으므로 여기서 제거한다.
// - mode === 'agent' 인 경우 tools와 systemPrompt를 payload에 섞어 넣는다.
function buildOpenAIResponsesPayload(req: ResponsesCreateParams): OpenAIResponsesPayload {
  const {
    mode,
    tools,
    systemPrompt,
    stream,
    toolChoice,
    topP,
    maxOutputTokens,
    input: rawInput = [],
    ...rest
  } = req;

  const baseInput = rawInput.map(toOpenAIInputItem);
  const input: OpenAIResponsesPayload['input'] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...baseInput]
    : baseInput;

  const payload: OpenAIResponsesPayload = {
    ...rest,
    input,
    stream,
    ...(typeof topP === 'number' ? { top_p: topP } : {}),
    ...(typeof maxOutputTokens === 'number' ? { max_output_tokens: maxOutputTokens } : {}),
  };

  const openAITools: AgentToolSchema[] | undefined =
    Array.isArray(tools) && tools.length > 0 ? tools : undefined;

  if (mode === 'agent' && openAITools?.length) {
    payload.tools = openAITools;
    payload.tool_choice = 'auto';
  } else {
    if (openAITools?.length) {
      payload.tools = openAITools;
    }
    if (toolChoice) {
      payload.tool_choice = toolChoice;
    }
  }

  if (mode) {
    payload.metadata = {
      ...(rest.metadata ?? {}),
      agent_mode: mode,
    };
  } else if (rest.metadata) {
    payload.metadata = rest.metadata;
  }

  return payload;
}

export interface OpenAIProviderConfig {
  /**
   * ex) "https://api.openai.com" or 게이트웨이 베이스 URL
   * 라우터에서 환경변수로 resolve 한 값 넣어주면 됨.
   */
  baseUrl: string;
  /**
   * 실제 Authorization 헤더에 들어갈 키
   */
  apiKey: string;
  /**
   * 필요하다면, 게이트웨이에서 provider 선택용 커스텀 헤더 등에 사용
   * (안 쓰면 undefined 둬도 됨)
   */
  provider?: string;
}

function getBaseUrl(): string {
  return process.env.LLM_BASE_URL ?? 'https://api.openai.com';
}
function getApiKey(): string {
  return process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY!;
}
function getProvider(): string {
  return process.env.LLM_PROVIDER ?? 'openai-chat';
}

function resolveProviderConfig(): OpenAIProviderConfig {
  return {
    baseUrl: getBaseUrl(),
    apiKey: getApiKey(),
    provider: getProvider(),
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildHeaders(apiKey: string, provider?: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...(provider ? { 'X-LLM-Provider': provider } : {}),
  };
}

function buildJsonHeaders(apiKey: string, provider?: string): HeadersInit {
  return {
    ...buildHeaders(apiKey, provider),
    'Content-Type': 'application/json',
  };
}

function parseSSEDataLine(line: string): string | null {
  if (!line || !line.startsWith('data:')) {
    return null;
  }
  return line.replace(/^data:\s*/, '');
}

function parseEventPayload(payloadPart: string): OpenAIStreamMessage | null {
  try {
    const parsed = JSON.parse(payloadPart);
    return typeof parsed === 'object' && parsed !== null ? (parsed as OpenAIStreamMessage) : null;
  } catch {
    return null;
  }
}

function collectOutputText(output: LLMResponseOutputItem[]): string {
  const textParts: string[] = [];

  for (const item of output) {
    if (!item || item.type !== 'message') continue;

    const message = item as LLMOutputMessage;
    if (!Array.isArray(message.content)) continue;

    for (const part of message.content) {
      const textPart = part as LLMOutputTextContentPart | undefined;
      if (textPart?.type === 'output_text') {
        textParts.push(textPart.text);
      }
    }
  }

  return textParts.join('');
}

function mapUsageFromOpenAI(value: unknown): LLMTokenUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const usage = value as Record<string, unknown>;

  const inputTokens =
    typeof usage.input_tokens === 'number'
      ? usage.input_tokens
      : (usage as { inputTokens?: number }).inputTokens;
  const outputTokens =
    typeof usage.output_tokens === 'number'
      ? usage.output_tokens
      : (usage as { outputTokens?: number }).outputTokens;
  const totalTokens =
    typeof usage.total_tokens === 'number'
      ? usage.total_tokens
      : (usage as { totalTokens?: number }).totalTokens;

  if (
    typeof inputTokens !== 'number' ||
    typeof outputTokens !== 'number' ||
    typeof totalTokens !== 'number'
  ) {
    return undefined;
  }

  const result: LLMTokenUsage = {
    inputTokens,
    outputTokens,
    totalTokens,
  };

  if (usage.input_tokens_details && typeof usage.input_tokens_details === 'object') {
    const details = usage.input_tokens_details as Record<string, unknown>;
    const mappedDetails: LLMTokenUsageInputDetails = {};
    if (typeof details.cached_tokens === 'number') {
      mappedDetails.cachedTokens = details.cached_tokens;
    } else if (typeof (details as { cachedTokens?: number }).cachedTokens === 'number') {
      mappedDetails.cachedTokens = (details as { cachedTokens?: number }).cachedTokens;
    }
    if (Object.keys(mappedDetails).length > 0) {
      result.inputTokensDetails = mappedDetails;
    }
  }
  if (usage.output_tokens_details && typeof usage.output_tokens_details === 'object') {
    const details = usage.output_tokens_details as Record<string, unknown>;
    const mappedDetails: LLMTokenUsageOutputDetails = {};
    if (typeof details.reasoning_tokens === 'number') {
      mappedDetails.reasoningTokens = details.reasoning_tokens;
    } else if (typeof (details as { reasoningTokens?: number }).reasoningTokens === 'number') {
      mappedDetails.reasoningTokens = (details as { reasoningTokens?: number }).reasoningTokens;
    }
    if (Object.keys(mappedDetails).length > 0) {
      result.outputTokensDetails = mappedDetails;
    }
  }

  return result;
}

function mapFunctionCallFromOpenAI(item: Record<string, unknown>): FunctionToolCall | undefined {
  if (item.type !== 'function_call' || typeof item.call_id !== 'string') return undefined;
  return {
    ...(typeof item.id === 'string' ? { id: item.id } : {}),
    type: 'function_call',
    arguments: typeof item.arguments === 'string' ? item.arguments : '',
    callId: item.call_id,
    name: typeof item.name === 'string' ? item.name : 'unknown',
    status: (item.status as FunctionToolCall['status']) ?? 'in_progress',
  };
}

function mapFunctionCallOutputFromOpenAI(
  item: Record<string, unknown>,
): FunctionToolCallOutput | undefined {
  if (item.type !== 'function_call_output' || typeof item.call_id !== 'string') return undefined;
  return {
    ...(typeof item.id === 'string' ? { id: item.id } : {}),
    type: 'function_call_output',
    callId: item.call_id,
    output: Array.isArray(item.output) || typeof item.output === 'string' ? item.output : '',
    status: (item.status as FunctionToolCallOutput['status']) ?? 'in_progress',
  };
}

function mapReasoningFromOpenAI(item: Record<string, unknown>): Reasoning | undefined {
  if (item.type !== 'reasoning') return undefined;
  if (!Array.isArray(item.summary)) return undefined;

  return {
    ...(typeof item.id === 'string' ? { id: item.id } : {}),
    type: 'reasoning',
    summary: item.summary as Reasoning['summary'],
    content: Array.isArray(item.content) ? (item.content as Reasoning['content']) : undefined,
    encryptedContent:
      typeof item.encrypted_content === 'string' ? item.encrypted_content : undefined,
    status: (item.status as Reasoning['status']) ?? 'in_progress',
  };
}

function mapWebSearchCallFromOpenAI(item: Record<string, unknown>) {
  if (item.type !== 'web_search_call') return undefined;
  const status: 'in_progress' | 'completed' | 'incomplete' =
    item.status === 'completed' || item.status === 'incomplete' ? item.status : 'in_progress';
  return {
    type: 'web_search_call' as const,
    ...(typeof item.id === 'string' ? { id: item.id } : {}),
    status,
    data: item.web_search ?? item,
  };
}

function mapOutputItemFromOpenAI(item: unknown): LLMResponseOutputItem | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const typed = item as Record<string, unknown>;
  switch (typed.type) {
    case 'message':
      return typed as unknown as LLMOutputMessage;
    case 'function_call':
      return mapFunctionCallFromOpenAI(typed);
    case 'function_call_output':
      return mapFunctionCallOutputFromOpenAI(typed);
    case 'reasoning':
      return mapReasoningFromOpenAI(typed);
    case 'web_search_call':
      return mapWebSearchCallFromOpenAI(typed);
    default:
      return undefined;
  }
}

function mapResponseObjectFromOpenAI(value: unknown): LLMResponseObject | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;

  const outputItems = Array.isArray(obj.output)
    ? (obj.output as unknown[]).map(mapOutputItemFromOpenAI).filter(Boolean)
    : [];

  const createdAt =
    typeof obj.created_at === 'number' && Number.isFinite(obj.created_at)
      ? obj.created_at
      : Number.isFinite((obj as { createdAt?: number }).createdAt)
        ? (obj as { createdAt?: number }).createdAt!
        : Date.now();

  const maxOutputTokensValue =
    typeof obj.max_output_tokens === 'number'
      ? obj.max_output_tokens
      : typeof (obj as { maxOutputTokens?: number | null }).maxOutputTokens === 'number'
        ? (obj as { maxOutputTokens?: number | null }).maxOutputTokens
        : (obj.max_output_tokens as null | undefined);

  const previousResponseIdValue =
    typeof obj.previous_response_id === 'string'
      ? obj.previous_response_id
      : typeof (obj as { previousResponseId?: string | null }).previousResponseId === 'string'
        ? (obj as { previousResponseId?: string | null }).previousResponseId
        : null;

  const outputTextValue =
    typeof obj.output_text === 'string'
      ? obj.output_text
      : (obj as { outputText?: string }).outputText;

  const topPValue = typeof obj.top_p === 'number' ? obj.top_p : (obj as { topP?: number }).topP;

  return {
    id: typeof obj.id === 'string' ? obj.id : '',
    createdAt,
    error: obj.error as LLMError | undefined,
    model: typeof obj.model === 'string' ? obj.model : '',
    status: obj.status as LLMResponseStatus | undefined,
    maxOutputTokens: maxOutputTokensValue,
    previousResponseId: previousResponseIdValue,
    outputText: outputTextValue,
    output: outputItems as LLMResponseOutputItem[],
    usage: mapUsageFromOpenAI(obj.usage ?? (obj as { usage?: unknown }).usage),
    reasoning: obj.reasoning as LLMResponseReasoningPayload | undefined,
    topP: topPValue ?? null,
    temperature: typeof obj.temperature === 'number' ? obj.temperature : undefined,
    incompleteDetails: obj.incomplete_details as LLMIncompleteDetails | null | undefined,
  };
}

function mapOpenAIEvent(event: OpenAIStreamMessage): LLMStreamEvent[] {
  const mappedEvents: LLMStreamEvent[] = [];
  const eventType = typeof event.type === 'string' ? event.type : undefined;

  if (eventType && eventType !== 'response.output_text.delta') {
    console.log('[Stream] OpenAI event:', eventType);
  }

  switch (eventType) {
    case 'response.output_text.delta': {
      const delta = typeof event.delta === 'string' ? event.delta : '';
      if (delta) {
        mappedEvents.push({
          type: LLMStreamEventType.Delta,
          role: 'assistant',
          content: delta,
        });
      }
      break;
    }
    case 'response.incomplete': {
      const response = mapResponseObjectFromOpenAI(event.response);
      if (response) {
        mappedEvents.push({ type: LLMStreamEventType.Incomplete, response });
      }
      break;
    }
    case 'response.completed': {
      const responseObj = mapResponseObjectFromOpenAI(event.response);
      const output = responseObj?.output ?? [];
      const usage = responseObj?.usage ?? mapUsageFromOpenAI(event.usage);

      mappedEvents.push({
        type: LLMStreamEventType.Complete,
        id: responseObj?.id,
        outputText: responseObj?.outputText ?? collectOutputText(output),
        output,
        maxOutputTokens:
          typeof responseObj?.maxOutputTokens === 'number'
            ? responseObj.maxOutputTokens
            : undefined,
        reasoning: responseObj?.reasoning as LLMResponseReasoningPayload | undefined,
        topP: typeof responseObj?.topP === 'number' ? responseObj.topP : undefined,
        temperature: responseObj?.temperature,
        usage,
      });
      break;
    }
    case 'response.output_item.added': {
      break;
    }
    case 'response.output_item.done': {
      console.log('[Stream] OpenAI response done event:', event);
      const item = mapOutputItemFromOpenAI(event.item);

      if (item?.type === 'function_call') {
        mappedEvents.push({ type: LLMStreamEventType.FunctionCall, item });
      }
      if (item?.type === 'reasoning') {
        mappedEvents.push({ type: LLMStreamEventType.Reasoning, item: item as Reasoning });
      }
      if (item?.type === 'web_search_call') {
        mappedEvents.push({ type: LLMStreamEventType.OpenAIWebSearchCall, data: item });
      }
      break;
    }
    case 'error': {
      mappedEvents.push({
        type: LLMStreamEventType.Error,
        error: (event.error as LLMStreamErrorPayload | undefined) ?? {
          message: 'Unknown upstream error event',
          raw: event,
        },
        provider: OPENAI_PROVIDER_LABEL,
      });
      break;
    }
    case 'web_search_call.in_progress': {
      const item = mapWebSearchCallFromOpenAI((event.item ?? {}) as Record<string, unknown>);
      mappedEvents.push({
        type: LLMStreamEventType.OpenAIWebSearchCall,
        data: item ?? event.item ?? event,
      });
      break;
    }
    default: {
      if (typeof eventType === 'string' && eventType.includes('tool')) {
        console.log('[Agent] Tool-related SSE event from upstream:', event);
      }
      break;
    }
  }

  return mappedEvents;
}

/**
 * OpenAI Responses API 호출용 프로바이더.
 *
 * - payload: /v1/responses 바디 그대로 (model, input, stream 등 포함)
 * - config: 베이스 URL / API 키 / provider 등
 */
export const openAIProvider: LLMProvider = {
  async *createStreamResponse(req): AsyncGenerator<LLMStreamEvent> {
    const config = resolveProviderConfig();
    const payload: StreamPayload = {
      ...buildOpenAIResponsesPayload({ ...req, stream: true }),
      stream: true,
    };

    const enc = getEncoding('o200k_base');
    const token = enc.encode(JSON.stringify(payload));
    console.log('token:', token.length);

    yield* streamOpenAIResponses(payload, config);
  },
  async createTextResponse(req) {
    const config = resolveProviderConfig();
    const payload: NonStreamPayload = {
      ...buildOpenAIResponsesPayload({ ...req, stream: false }),
      stream: false,
    };

    return textOpenAIResponses(payload, config);
  },
  async getModels(): Promise<string[]> {
    const { baseUrl, apiKey, provider } = resolveProviderConfig();
    const url = `${normalizeBaseUrl(baseUrl)}/v1/models`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(apiKey, provider),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch models from LLM upstream';
      throw new Error(message);
    }

    if (!res.ok) {
      let detail: string | undefined;
      try {
        const text = await res.text();
        detail = text || undefined;
      } catch {
        // ignore
      }
      throw new Error(
        detail ?? `Upstream error while fetching models: ${res.status} ${res.statusText}`,
      );
    }

    try {
      const json = (await res.json()) as {
        data?: Array<{ id?: string }>;
      };

      if (!json.data || !Array.isArray(json.data)) {
        return Promise.reject(new Error('Invalid models response shape'));
      }

      return json.data
        .map(m => m.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse models response';
      throw new Error(message);
    }
  },
};

export async function* streamOpenAIResponses(
  payload: StreamPayload,
  config: OpenAIProviderConfig,
): AsyncGenerator<LLMStreamEvent> {
  const { baseUrl, apiKey, provider } = config;
  const url = `${normalizeBaseUrl(baseUrl)}/v1/responses`;

  let upstreamRes: Response;

  try {
    upstreamRes = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(apiKey, provider),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const errorPayload: LLMStreamErrorPayload =
      err instanceof Error
        ? { message: err.message, code: 'network_error', raw: err }
        : { message: 'Network error', code: 'network_error', raw: err };
    yield { type: LLMStreamEventType.Error, error: errorPayload, provider: OPENAI_PROVIDER_LABEL };
    return;
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    const text = await safeReadText(upstreamRes);
    console.error(
      `[OpenAI] Error response from upstream:  ${upstreamRes.status} ${upstreamRes.statusText}`,
    );

    yield {
      type: LLMStreamEventType.Error,
      error: {
        message: upstreamRes.statusText || 'Upstream error',
        code: upstreamRes.status.toString(),
        status: upstreamRes.status,
        raw: text ?? undefined,
      },
      provider: OPENAI_PROVIDER_LABEL,
    };
    return;
  }

  // 여기까지 왔으면 클라에선 "연결 성공"으로 보고 init 이벤트 한 번 보내줄 수 있음
  yield { type: 'init' };

  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';

  try {
    // OpenAI Responses API는 SSE / data: 라인 기반 스트림을 흘려보냄
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;

      // 여러 청크가 섞여 들어올 수 있어서 \n 기준으로 잘라가며 처리
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trimEnd();
        buffer = buffer.slice(newlineIndex + 1);

        const payloadPart = parseSSEDataLine(line);
        if (!payloadPart) continue;

        // 스트림 종료 신호
        if (payloadPart === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        const event = parseEventPayload(payloadPart);
        if (!event) continue;

        const mappedEvents = mapOpenAIEvent(event);
        for (const mappedEvent of mappedEvents) {
          yield mappedEvent;
        }
      }
    }
    // 스트림이 자연 종료되었으면 done 한 번 더 쏴줄 수 있음
    yield { type: 'done' };
  } finally {
    reader.releaseLock();
  }
}

export async function textOpenAIResponses(
  payload: NonStreamPayload,
  config: OpenAIProviderConfig,
): Promise<LLMResponseObject> {
  const { baseUrl, apiKey, provider } = config;
  const url = `${normalizeBaseUrl(baseUrl)}/v1/responses`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(apiKey, provider),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Network error while fetching OpenAI response';
    throw new Error(message);
  }

  if (!res.ok) {
    const text = await safeReadText(res);
    throw new Error(text ?? `Upstream error while fetching responses: ${res.status}`);
  }

  try {
    const json = await res.json();
    const mapped = mapResponseObjectFromOpenAI(json);
    if (!mapped) {
      return Promise.reject(new Error('Invalid OpenAI response payload shape'));
    }
    return mapped;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse OpenAI response JSON';
    throw new Error(message);
  }
}

async function safeReadText(res: Response): Promise<string | null> {
  try {
    const text = await res.text();
    return text || null;
  } catch {
    return null;
  }
}
