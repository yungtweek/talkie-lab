'use client';

import { useCallback, useMemo } from 'react';

import { type InferenceConfigContextValue } from '@/components/inference-config-provider';
import { type ChatMessage } from '@/hooks/use-chat';
import { type AgentMode, type AgentToolSchema } from '@/lib/ai/agents/types';
import { type ReasoningEffort } from '@/lib/ai/llm/model-registry';
import { type InputMessage } from '@/lib/ai/llm/types';

export interface BuildChatRequestParams {
  input: string;
  messages: ChatMessage[];
  conversationId: string;
}

export type BuildChatRequest = (params: BuildChatRequestParams) => {
  conversationId: string;
  stream?: boolean;
} & Record<string, unknown>;

export interface ChatRequestContext {
  conversationId: string;
  modelName?: string | null;
  reasoningEfforts?: ReasoningEffort[] | null;
  stream: boolean;
  chatMode: AgentMode;
  systemPrompt: string;
  systemPromptText?: string | null;
  tools?: AgentToolSchema[];
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  modelMaxTokens?: number | null;
  supportsTemperature?: boolean;
  supportsTopP?: boolean;
  promptMetadataId?: string | null;
  promptId?: string | null;
}

export function buildChatRequestBody(
  { input, messages, conversationId }: BuildChatRequestParams,
  ctx: ChatRequestContext,
) {
  const normalizedHistory: InputMessage[] = [];

  for (const msg of messages) {
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;
    if (normalizedHistory.length === 0) {
      normalizedHistory.push({ role: msg.role, content: msg.content });
      continue;
    }

    const last = normalizedHistory[normalizedHistory.length - 1];
    if (msg.role === 'user' && last.role === 'user') {
      normalizedHistory[normalizedHistory.length - 1] = {
        role: msg.role,
        content: msg.content,
      };
    } else {
      normalizedHistory.push({ role: msg.role, content: msg.content });
    }
  }

  const combined: InputMessage[] = [...normalizedHistory, { role: 'user', content: input }];
  const limitedHistory = combined.slice(-5);

  const body: { conversationId: string; stream?: boolean } & Record<string, unknown> = {
    conversationId,
    model: ctx.modelName ?? undefined,
    input: limitedHistory,
    stream: ctx.stream,
    mode: ctx.chatMode,
    systemPrompt: ctx.systemPrompt,
    systemPromptText: ctx.systemPromptText ?? ctx.systemPrompt,
    tools: ctx.tools,
  };

  body.promptMetadataId = ctx.promptMetadataId ?? null;
  body.promptId = ctx.promptId ?? null;

  if (ctx.reasoningEfforts && ctx.reasoningEfforts.length > 0) {
    if (ctx.reasoningEffort && ctx.reasoningEfforts.includes(ctx.reasoningEffort)) {
      body.reasoning = { effort: ctx.reasoningEffort };
    }
  }

  if (ctx.supportsTemperature) {
    body.temperature = ctx.temperature;
  }

  if (ctx.supportsTopP) {
    body.topP = ctx.topP;
  }

  if (typeof ctx.maxOutputTokens === 'number') {
    body.maxOutputTokens =
      typeof ctx.modelMaxTokens === 'number'
        ? Math.min(ctx.maxOutputTokens, ctx.modelMaxTokens)
        : ctx.maxOutputTokens;
  }

  return body;
}

export function useChatRequestBuilder(
  conversationId: string,
  cfg: InferenceConfigContextValue,
): BuildChatRequest {
  const {
    model,
    stream,
    chatMode,
    systemPrompt,
    agent,
    reasoningEffort,
    temperature,
    topP,
    maxOutputTokens,
    promptMetadataId,
    promptId,
  } = cfg;

  const context = useMemo<ChatRequestContext>(
    () => ({
      conversationId,
      modelName: model?.name ?? null,
      reasoningEfforts: model?.reasoningEfforts ?? null,
      stream,
      chatMode,
      systemPrompt,
      systemPromptText: systemPrompt,
      promptMetadataId,
      promptId,
      tools: agent?.tools,
      reasoningEffort,
      temperature,
      topP,
      maxOutputTokens,
      modelMaxTokens: model?.maxTokens?.max ?? null,
      supportsTemperature: Boolean(model?.temperature),
      supportsTopP: Boolean(model?.topP),
    }),
    [
      agent?.tools,
      chatMode,
      conversationId,
      maxOutputTokens,
      model?.maxTokens?.max,
      model?.name,
      model?.reasoningEfforts,
      model?.temperature,
      model?.topP,
      promptId,
      promptMetadataId,
      stream,
      systemPrompt,
      temperature,
      topP,
      reasoningEffort,
    ],
  );

  return useCallback(params => buildChatRequestBody(params, context), [context]);
}
