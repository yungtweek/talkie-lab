// src/lib/llm/types.ts

import { type AgentMode, type AgentToolSchema } from '@/lib/ai/agents/types';
import { type ChatMetricsViewModel } from '@/lib/types/chat';

export interface LLMError {
  type: 'error';
  code: string;
  message: string;
  param?: string | null;
}

export interface InputMessage {
  type?: 'message';
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string;
  status?: 'in_progress' | 'completed' | 'incomplete';
}

export interface OutputMessage {
  id: string;
  role: 'assistant';
  content: string;
  type: 'message';
  status: 'in_progress' | 'completed' | 'incomplete';
}

export interface FunctionToolCall {
  id?: string;
  type: 'function_call';
  arguments: string;
  callId: string;
  name: string;
  status: 'in_progress' | 'completed' | 'incomplete';
}

export interface FunctionToolCallOutput {
  id?: string;
  type: 'function_call_output';
  callId: string;
  output: string | string[];
  status?: 'in_progress' | 'completed' | 'incomplete';
}

export interface OpenAIWebSearchCallOutput {
  id?: string;
  type: 'web_search_call';
  status?: 'in_progress' | 'completed' | 'incomplete';
  /** Raw payload from OpenAI; opaque passthrough for now. */
  data: unknown;
}

export type ReasoningTextType = 'summary_text' | 'reasoning_text';

export interface ReasoningTextItem {
  text: string;
  type: ReasoningTextType;
}

export interface Reasoning {
  id?: string;
  type: 'reasoning';
  summary: ReasoningTextItem[];
  content?: ReasoningTextItem[];
  encryptedContent?: string;
  status: 'in_progress' | 'completed' | 'incomplete';
}

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';
export interface ReasoningConfig {
  effort: ReasoningEffort;
}

export type ProviderKey = 'openai' | 'local' | 'gateway';

export type ModelString = `${ProviderKey}:${string}` | string;

export type InputItem = InputMessage | FunctionToolCall | FunctionToolCallOutput | Reasoning;

export type ToolRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ToolRunSnapshot {
  /** Unique identifier for a single tool execution (e.g. function_call id). */
  id: string;
  functionCallId?: string;
  /** Tool name (should match the function/tool name from the model). */
  name: string;
  /** High-level status for this tool execution within a single response. */
  status: ToolRunStatus;
  /** Raw arguments payload passed to the tool, if available. */
  args?: unknown;
  /** Optional preview of the tool result for UI rendering / logging. */
  resultPreview?: unknown;
}

export interface ResponsesCreateParams {
  model: ModelString;
  input: InputItem[];
  reasoning?: ReasoningConfig;
  stream?: boolean; // TODO: Use for SSE/streaming responses
  mode?: AgentMode;
  tools?: AgentToolSchema[];
  toolChoice?: 'auto' | 'first' | 'last';
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
}

export interface ResponsesCreateResult {
  outputText: string; // TODO: UI-ready output text
  raw: unknown; // TODO: Raw provider response
}

export interface LLMTokenUsageInputDetails {
  /** Number of tokens served from prompt cache (if any). */
  cachedTokens?: number;
}

export interface LLMTokenUsageOutputDetails {
  /** Number of tokens used specifically for reasoning traces (if provided by the model). */
  reasoningTokens?: number;
}

/**
 * Token usage information returned by the provider.
 * Mirrors the OpenAI `usage` object shape.
 */
export interface LLMTokenUsage {
  /** Number of input tokens. */
  inputTokens: number;
  /** Optional detailed breakdown of input tokens. */
  inputTokensDetails?: LLMTokenUsageInputDetails;
  /** Number of output tokens. */
  outputTokens: number;
  /** Optional detailed breakdown of output tokens. */
  outputTokensDetails?: LLMTokenUsageOutputDetails;
  /** Total tokens used (input + output). */
  totalTokens: number;
}

export interface LLMOutputTextContentPart {
  /** Output text content from the model. */
  type: 'output_text';
  /** The generated text. */
  text: string;
}

export interface LLMOutputRefusalPart {
  /** Refusal content from the model. */
  type: 'refusal';
  /** Natural-language explanation or refusal message. */
  message: string;
}

export interface LLMOutputMessage {
  /** Unique identifier for the message item. */
  id: string;
  /** Fixed type for messages in the Responses output. */
  type: 'message';
  /** Role of the message author. In Responses output this is typically 'assistant'. */
  role: 'assistant' | 'user' | 'system' | 'developer';
  /** Streaming / completion status for this message. */
  status: 'in_progress' | 'completed' | 'incomplete';
  /** Content parts for the message. For now we only model output_text. */
  content: Array<LLMOutputTextContentPart | LLMOutputRefusalPart>;
}

/**
 * Single item in the Responses `output` array.
 * This is a simplified view over `ResponseOutputItem` from the OpenAI SDK,
 * limited to the shapes we actually use in Talkie-Lab.
 */
export type LLMResponseOutputItem =
  | LLMOutputMessage
  | Reasoning
  | FunctionToolCall
  | FunctionToolCallOutput
  | OpenAIWebSearchCallOutput;

export type LLMResponseStatus = 'completed' | 'failed' | 'in_progress' | 'incomplete';

export interface LLMIncompleteDetails {
  reason?: 'max_output_tokens' | 'content_filter' | 'error' | 'other';
}

export type LLMStreamErrorPayload =
  | LLMError
  | {
      message: string;
      code?: string;
      status?: number;
      raw?: unknown;
    }
  | Error;

export interface LLMResponseReasoningPayload {
  effort: ReasoningEffort;
  summary: string;
}

export interface LLMResponseObject {
  id: string;
  createdAt: number;
  error?: LLMError;
  model: string;
  status?: LLMResponseStatus;
  maxOutputTokens?: number | null;
  previousResponseId?: string | null;
  outputText?: string;
  output: LLMResponseOutputItem[];
  usage?: LLMTokenUsage;
  reasoning?: LLMResponseReasoningPayload;
  topP?: number | null;
  temperature?: number | null;
  incompleteDetails?: LLMIncompleteDetails | null;
}

export const LLMStreamEventType = {
  Init: 'init',
  Delta: 'delta',
  Result: 'result',
  Done: 'done',
  Error: 'error',
  FunctionCall: 'function_call',
  Reasoning: 'reasoning',
  Complete: 'complete',
  UsingTool: 'using_tool',
  Incomplete: 'incomplete',
  OpenAIWebSearchCall: 'web_search_call',
} as const;

export type LLMStreamEventType = (typeof LLMStreamEventType)[keyof typeof LLMStreamEventType];

export type LLMStreamEvent =
  | { type: typeof LLMStreamEventType.Init }
  | { type: typeof LLMStreamEventType.Delta; role: 'assistant'; content: string }
  | { type: typeof LLMStreamEventType.Result; role: 'assistant'; content: string }
  | { type: typeof LLMStreamEventType.Done }
  | {
      type: typeof LLMStreamEventType.Complete;
      id?: string;
      outputText: string;
      output: LLMResponseOutputItem[];
      maxOutputTokens?: number;
      reasoning?: LLMResponseReasoningPayload;
      topP?: number;
      temperature?: number | null;
      usage?: LLMTokenUsage;
      toolCalls?: ToolRunSnapshot[];
      messageMetrics?: ChatMetricsViewModel;
    }
  | {
      type: typeof LLMStreamEventType.Incomplete;
      response: LLMResponseObject;
    }
  | { type: typeof LLMStreamEventType.OpenAIWebSearchCall; data: unknown }
  | { type: typeof LLMStreamEventType.FunctionCall; item: FunctionToolCall }
  | { type: typeof LLMStreamEventType.Reasoning; item: Reasoning }
  | { type: typeof LLMStreamEventType.UsingTool; item: ToolRunSnapshot }
  | { type: typeof LLMStreamEventType.Error; error: LLMStreamErrorPayload; provider?: string };
