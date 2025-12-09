// src/app/chat/api/chat/route.ts
import { auth } from '@/app/(auth)/auth';
import { extractLatestUserContent } from '@/app/(chat)/api/chat/extract-user';
import { generateTitleFromUserMessage } from '@/app/(chat)/chat/actions';
import { generateStreamResponse } from '@/lib/ai/llm/router';
import {
  type LLMStreamEvent,
  type LLMStreamEventType,
  type ProviderKey,
  type LLMTokenUsage,
  type ResponsesCreateParams,
  type FunctionToolCall,
} from '@/lib/ai/llm/types';
import {
  createConversation,
  createMessage,
  findConversationById,
  getNextTurn,
  updateConversationLastMessageAt,
  upsertMessageMetrics,
  upsertConversationState,
  upsertToolCall,
} from '@/lib/repositories/conversation-repository';

import type { NextRequest } from 'next/server';

// export const runtime = 'edge'; // 이미 쓰고 있으면 유지, 없으면 빼도 됨
export const runtime = 'nodejs';

type ChatRoutePayload = ResponsesCreateParams & {
  conversationId?: string;
  systemPromptText?: string | null;
  promptMetadataId?: string | null;
  promptId?: string | null;
};

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const buildConversationStateSnapshot = (payload: ChatRoutePayload) => {
  const systemPromptText =
    typeof payload.systemPromptText === 'string'
      ? payload.systemPromptText
      : typeof payload.systemPrompt === 'string'
        ? payload.systemPrompt
        : null;

  const promptMetadataId =
    toNullableString(payload.promptMetadataId) ??
    toNullableString(payload.metadata?.promptMetadataId);
  const promptId =
    toNullableString(payload.promptId) ?? toNullableString(payload.metadata?.promptId);

  return {
    systemPromptText,
    promptMetadataId,
    promptId,
  };
};

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
  const payload = (await req.json()) as ChatRoutePayload;
  const apiKey = process.env.LLM_API_KEY;
  const providerEnv = process.env.LLM_PROVIDER as ProviderKey | undefined; // 있으면 쓰고, 없으면 무시

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        type: 'error',
        message: 'LLM_API_KEY is not configured on the server',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      let closed = false;

      const safeClose = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const send = (chunk: unknown) => {
        if (closed) return;
        const line = JSON.stringify(chunk) + '\n';
        controller.enqueue(encoder.encode(line));
      };

      try {
        const session = await auth();
        const userId = (session?.user as { id?: string } | undefined)?.id;

        if (!userId) {
          send({ type: 'error', message: 'Unauthorized' });
          safeClose();
          return;
        }

        const { conversationId, ...restPayload } = payload;

        if (!conversationId) {
          send({ type: 'error', message: 'conversationId is required' });
          safeClose();
          return;
        }

        const conversationStateSnapshot = buildConversationStateSnapshot(payload);
        const {
          systemPromptText: _systemPromptText,
          promptMetadataId: _promptMetadataId,
          promptId: _promptId,
          ...llmPayload
        } = restPayload;

        const existing = await findConversationById(conversationId);
        const userContent = extractLatestUserContent(llmPayload.input);
        if (!existing) {
          const { title } = await generateTitleFromUserMessage({
            role: 'user',
            content: userContent,
          });

          const conversation = await createConversation({
            id: conversationId,
            title,
            userId,
          });

          send({
            type: 'conversation_created',
            conversation,
          });
        }

        const nextTurn = await getNextTurn(conversationId);

        if (userContent) {
          await createMessage({
            conversationId,
            role: 'user',
            content: userContent,
            turn: nextTurn,
            indexInTurn: 0,
            modelUsed: llmPayload.model,
            mode: llmPayload.mode,
          });
        }
        await updateConversationLastMessageAt({ conversationId });

        let assistantText = '';
        let completeText: string | undefined;
        let usage: LLMTokenUsage | undefined;
        let responseId: string | undefined;
        let maxOutputTokens: number | undefined;
        let reasoningEffort: string | undefined;
        let temperature: number | undefined;
        let topP: number | undefined;

        const startedAt = Date.now();
        let firstTokenAt: number | null = null;
        let lastTokenAt: number | null = null;
        const toolCalls = [];
        const safeParseArguments = (value: unknown) => {
          if (typeof value !== 'string') return value as unknown;
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        };

        const streamSource = generateStreamResponse(llmPayload as ResponsesCreateParams, {
          provider: providerEnv,
        });

        // LLM 라우터에서 스트림 받아오기
        for await (const chunk of streamSource as AsyncGenerator<LLMStreamEvent>) {
          let outChunk: LLMStreamEvent = chunk;
          if (chunk && typeof chunk === 'object' && 'type' in chunk) {
            const { type } = chunk as LLMStreamEvent;

            if (type === 'delta') {
              const delta = chunk as { content?: unknown };
              if (typeof delta.content === 'string') {
                if (!firstTokenAt) {
                  firstTokenAt = Date.now();
                }
                assistantText += delta.content;
              }
            }

            if (type === 'function_call') {
              const functionCall = chunk as Extract<
                LLMStreamEvent,
                { type: typeof LLMStreamEventType.FunctionCall }
              >;
              toolCalls.push(functionCall.item);
            }

            if (type === 'complete') {
              const completeChunk = chunk as Extract<
                LLMStreamEvent,
                { type: typeof LLMStreamEventType.Complete }
              >;

              completeText = completeChunk.outputText;

              if (!lastTokenAt) {
                lastTokenAt = Date.now();
              }

              if (completeChunk.usage) {
                usage = completeChunk.usage;
              }

              if (typeof completeChunk.id === 'string') {
                responseId = completeChunk.id;
              }
              if (typeof completeChunk.maxOutputTokens === 'number') {
                maxOutputTokens = completeChunk.maxOutputTokens;
              }
              if (typeof completeChunk.reasoning === 'object') {
                reasoningEffort = completeChunk.reasoning.effort;
              }
              if (typeof completeChunk.topP === 'number') {
                topP = completeChunk.topP;
              }
              if (typeof completeChunk.temperature === 'number') {
                temperature = completeChunk.temperature;
              }

              // Compute timing metrics for this response
              const completedAtLocal = lastTokenAt ?? Date.now();
              const latencyMs = completedAtLocal - startedAt;
              const overheadLatencyMsLocal = Math.max(startedAt - requestStartedAt, 0);
              const providerLatencyMs =
                firstTokenAt != null ? Math.max(firstTokenAt - startedAt, 0) : null;

              // Attach messageMetrics only on complete events
              outChunk = {
                ...completeChunk,
                messageMetrics: {
                  role: 'assistant',
                  model: llmPayload.model ?? null,
                  // timings
                  latencyMs,
                  providerLatencyMs,
                  overheadLatencyMs: overheadLatencyMsLocal,
                  startedAt: new Date(startedAt).toISOString(),
                  firstTokenAt: firstTokenAt ? new Date(firstTokenAt).toISOString() : null,
                  completedAt: new Date(completedAtLocal).toISOString(),
                  // tokens
                  promptTokens: usage?.inputTokens ?? null,
                  completionTokens: usage?.outputTokens ?? null,
                  totalTokens: usage?.totalTokens ?? null,
                  // sampling / reasoning
                  temperature: temperature ?? null,
                  topP: topP ?? null,
                  reasoningEffort: reasoningEffort ?? null,
                  // error/raw left as defaults
                  errorMessage: null,
                  raw: null,
                },
              };
            }

            if (type === 'error') {
              console.error(chunk);
            }
            if (type === 'incomplete') {
              console.warn(chunk);
            }
          }
          send(outChunk);
        }

        const completedAt = lastTokenAt ?? Date.now();
        const overheadLatencyMs = Math.max(startedAt - requestStartedAt, 0);
        const finalAssistantText = completeText || assistantText;
        if (finalAssistantText) {
          const assistantMessage = await createMessage({
            conversationId,
            role: 'assistant',
            content: finalAssistantText,
            turn: nextTurn,
            indexInTurn: 1,
            modelUsed: llmPayload.model,
            mode: llmPayload.mode,
          });

          if (toolCalls.length > 0) {
            await Promise.all(
              toolCalls.map((toolCall: FunctionToolCall) =>
                upsertToolCall({
                  messageId: assistantMessage.id,
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                  callId: toolCall.callId ?? null,
                  arguments: safeParseArguments(toolCall.arguments),
                  result: null,
                  status: toolCall.status ?? null,
                }),
              ),
            );
          }

          await upsertMessageMetrics({
            conversationId,
            messageId: assistantMessage.id,
            requestId: responseId,
            traceId: undefined,
            // timing
            startedAt: new Date(startedAt),
            firstTokenAt: firstTokenAt ? new Date(firstTokenAt) : null,
            completedAt: new Date(completedAt),
            latencyMs: completedAt - startedAt,
            overheadLatencyMs,

            reasoningEffort,
            temperature,
            topP,
            maxOutputTokens,

            // tokens
            promptTokens: usage?.inputTokens ?? null,
            completionTokens: usage?.outputTokens ?? null,
            totalTokens: usage?.totalTokens ?? null,

            // config snapshot
            provider: providerEnv ?? null,
            modelUsed: llmPayload.model ?? null,
          });

          await upsertConversationState({
            conversationId,
            model: llmPayload.model ?? null,
            systemPromptText: conversationStateSnapshot.systemPromptText,
            promptMetadataId: conversationStateSnapshot.promptMetadataId,
            promptId: conversationStateSnapshot.promptId,
            reasoningEffort: reasoningEffort ?? null,
            temperature: temperature ?? null,
            topP: topP ?? null,
            maxOutputTokens: maxOutputTokens ?? null,
          });
        }
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown server error';
        send({ type: 'error', message });
      } finally {
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      // 프론트에서 NDJSON으로 읽기
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
