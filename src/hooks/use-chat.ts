'use client';

import {
  useRef,
  useCallback,
  useActionState,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { createTextResponseAction } from '@/app/(chat)/chat/actions';
import { useArtifactContext } from '@/components/artifact-provider';
import { type ConversationModel } from '@/generated/prisma/models/Conversation';
import { useChatMessages, useChatStatus } from '@/hooks/use-chat-state';
import { useStreamedResponse } from '@/hooks/use-streamed-response';
import {
  type BuildRequestBody,
  normalizeRequestBody,
  toActionRequestPayload,
} from '@/lib/ai/llm/payloads';
import {
  type LLMStreamEvent,
  LLMStreamEventType,
  type ToolRunSnapshot,
  type ResponsesCreateParams,
} from '@/lib/ai/llm/types';
import { defaultChatHeaders, extractOutputText, normalizeStreamError } from '@/lib/chat-client';
import { type ChatError, createChatError } from '@/lib/errors/chat-error';
import { type ChatMetricsViewModel } from '@/lib/types/chat';

import type { ArtifactLog, UIArtifact } from '@/hooks/use-artifact';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /**
   * Semantic type for the message. Currently, always 'text'.
   */
  type?: 'text';
  /**
   * Raw metrics data (aligned with listMessagesByConversationId).
   */
  messageMetrics?: ChatMetricsViewModel[];
  logs?: ArtifactLog[];
}

export interface UseChatStreamOptions {
  /** API endpoint for streaming chat responses (default: "/api/chat"). */
  api?: string;
  /** Whether to stream; if false, falls back to text (non-stream) responses via server action. */
  stream?: boolean;
  /** Conversation id to include in payloads. */
  conversationId: string;
  /** Optional initial messages for the current conversation (e.g., from server-rendered history). */
  initialMessages?: ChatMessage[];
  /**
   * Called when the server notifies that a conversation has been created.
   * The payload is the full ConversationModel from Prisma.
   */
  onConversationCreated?: (conversation: ConversationModel) => void;
}

interface SubmitState {
  lastInput: string | null;
  submissionId: number;
}

interface ConversationCreatedEvent {
  type: 'conversation_created';
  conversation: ConversationModel;
}
interface AssistantMessageCreatedEvent {
  type: 'assistant_message_created';
  messageId: string;
  conversationId: string;
  turn?: number;
  indexInTurn?: number;
}

type ChatEvent = LLMStreamEvent | ConversationCreatedEvent | AssistantMessageCreatedEvent;

const upsertToolRun = (prev: UIArtifact, snapshot: ToolRunSnapshot): UIArtifact['toolRuns'] => {
  const now = Date.now();
  const existing = prev.toolRuns.find(run => run.id === snapshot.id);
  const isTerminal = snapshot.status === 'succeeded' || snapshot.status === 'failed';

  if (!existing) {
    return [
      ...prev.toolRuns,
      {
        id: snapshot.id,
        name: snapshot.name,
        status: snapshot.status,
        startedAt: now,
        finishedAt: isTerminal ? now : undefined,
        args: snapshot.args,
        resultPreview: snapshot.resultPreview,
      },
    ];
  }

  return prev.toolRuns.map(run => {
    if (run.id !== snapshot.id) return run;
    return {
      ...run,
      name: snapshot.name ?? run.name,
      status: snapshot.status,
      args: snapshot.args ?? run.args,
      resultPreview: snapshot.resultPreview ?? run.resultPreview,
      finishedAt: isTerminal ? now : run.finishedAt,
    };
  });
};

interface StreamHandlerContext {
  controller: AbortController;
  updateArtifact: (updater?: (prev: UIArtifact) => Partial<UIArtifact>) => void;
  setArtifactIdle: (message?: string) => void;
  appendMessage: (msg: ChatMessage) => void;
  artifactRef: { current: UIArtifact };
  setChatError: Dispatch<SetStateAction<ChatError | null>>;
  onConversationCreated?: (conversation: ConversationModel) => void;
}

const createStreamEventHandler = (ctx: StreamHandlerContext) => {
  const { controller, updateArtifact, setArtifactIdle, appendMessage, artifactRef, setChatError } =
    ctx;

  return (evt: ChatEvent) => {
    if (controller.signal.aborted) return;

    if (evt.type === 'conversation_created') {
      ctx.onConversationCreated?.(evt.conversation);
      return;
    }

    if (evt.type === LLMStreamEventType.Init) {
      updateArtifact(() => ({
        content: '',
        status: 'init',
        actionState: 'pending',
      }));
      return;
    }

    if (evt.type === LLMStreamEventType.Delta) {
      const deltaText = evt.content ?? '';
      if (deltaText) {
        updateArtifact(prev => ({
          content: prev.content + deltaText,
          status: 'streaming',
          actionState: 'generating',
        }));
      }
      return;
    }

    if (evt.type === LLMStreamEventType.Incomplete) {
      const details = evt.response.incompleteDetails;
      const reason = details?.reason ?? 'other';

      const err = createChatError('upstream', `Response incomplete: ${reason}`, {
        provider: 'openai',
        raw: evt.response,
        retry: {
          model: evt.response.model,
          previousResponseId: evt.response.id,
          reason,
        },
      });

      setChatError(err);
      updateArtifact(_prev => ({
        status: 'error',
        actionState: 'none',
      }));
      return;
    }

    if (evt.type === LLMStreamEventType.Complete) {
      const finalText = evt.outputText ?? '';
      updateArtifact();
      const id = crypto.randomUUID();
      const messageMetrics =
        evt.messageMetrics != null
          ? [
              {
                ...evt.messageMetrics,
              },
            ]
          : undefined;

      if (finalText) {
        appendMessage({
          id,
          role: 'assistant',
          content: finalText,
          type: 'text',
          messageMetrics,
          logs: [...(artifactRef.current.logs ?? [])],
        });

        setArtifactIdle('stream_complete');
      }
      return;
    }

    if (evt.type === LLMStreamEventType.FunctionCall) {
      updateArtifact();
      return;
    }

    if (evt.type === LLMStreamEventType.Reasoning) {
      const summaryText = evt.item.summary?.map(part => part.text).join(' ') ?? '';
      const contentText = evt.item.content?.map(part => part.text).join(' ') ?? '';
      const reasoningText = `${summaryText} ${contentText}`.trim();

      if (reasoningText) {
        updateArtifact(prev => ({
          ...prev,
          actionState: 'reasoning',
        }));
      }
      return;
    }

    if (evt.type === LLMStreamEventType.UsingTool) {
      const snapshot = evt.item;
      updateArtifact(prev => {
        const toolRuns = upsertToolRun(prev, snapshot);
        const anyActive = toolRuns.some(
          run => run.status === 'running' || run.status === 'pending',
        );

        return {
          toolRuns,
          actionState: anyActive ? 'using-tool' : 'none',
        };
      });
      return;
    }

    if (evt.type === LLMStreamEventType.Error) {
      const err = normalizeStreamError(evt.error);

      setChatError(err);
      updateArtifact(() => ({
        status: 'error',
      }));
      setArtifactIdle('stream_error');

      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
  };
};

/**
 * Lightweight chat session hook backed by fetch + ReadableStream.
 *
 * Responsibilities:
 * - Manage a list of chat messages for the current session.
 * - Optimistically append the user message and an empty assistant placeholder.
 * - Open a streaming HTTP request to the given API endpoint.
 * - Incrementally update the last assistant message as deltas arrive.
 */
export function useChat(
  buildRequestBody: BuildRequestBody<ChatMessage>,
  options: UseChatStreamOptions,
) {
  const {
    api = '/api/chat',
    stream: streamOption,
    conversationId,
    initialMessages,
    onConversationCreated,
  } = options;

  const { messages, messagesRef, appendMessage } = useChatMessages<ChatMessage>(
    conversationId,
    initialMessages,
  );
  const { isStreaming, setIsStreaming, chatError, setChatError } = useChatStatus();

  const { artifact, setArtifact } = useArtifactContext();
  const artifactRef = useRef(artifact);
  const lastInputRef = useRef<string | null>(null);

  useEffect(() => {
    artifactRef.current = artifact;
  }, [artifact]);

  const updateArtifact = useCallback(
    (updater?: (prev: UIArtifact) => Partial<UIArtifact>) => {
      setArtifact(prev => ({
        ...prev,
        ...(updater ? updater(prev) : {}),
      }));
    },
    [setArtifact],
  );

  const abortRef = useRef<AbortController | null>(null);
  const lastHandledSubmissionIdRef = useRef(0);

  const setArtifactIdle = useCallback(() => {
    updateArtifact(() => ({
      content: '',
      status: 'idle',
      actionState: 'none',
      logs: [],
    }));
  }, [updateArtifact]);

  const [submitState, submitAction, isPending] = useActionState<SubmitState, FormData>(
    async (prevState, formData) => {
      const raw = formData.get('input');
      const value = typeof raw === 'string' ? raw.replace(/\r\n/g, '\n') : '';
      // Trim only leading/trailing spaces/tabs; keep internal and edge newlines intact.
      const trimmed = value.replace(/^[ \t]+|[ \t]+$/g, '');

      if (!trimmed) {
        return prevState;
      }

      setChatError(null);

      return {
        lastInput: trimmed,
        submissionId: prevState.submissionId + 1,
      };
    },
    { lastInput: null, submissionId: 0 },
  );

  const buildRequestBodyRef = useRef(buildRequestBody);
  useEffect(() => {
    buildRequestBodyRef.current = buildRequestBody;
  }, [buildRequestBody]);

  const { start: startStream } = useStreamedResponse();

  const startRequest = useCallback(
    (input: string, mode: 'new' | 'retry') => {
      if (!input) return;
      if (!conversationId) {
        throw new Error('conversationId is required for chat requests');
      }

      lastInputRef.current = input;

      if (mode === 'new') {
        appendMessage({
          id: crypto.randomUUID(),
          role: 'user',
          content: input,
        });
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      setChatError(null);
      setIsStreaming(true);

      const controller = abortRef.current;

      const requestMessages =
        mode === 'retry'
          ? (() => {
              const snapshot = [...messagesRef.current];
              const lastMessage = snapshot[snapshot.length - 1];
              if (lastMessage?.role === 'user' && lastMessage.content === input) {
                snapshot.pop();
              }
              return snapshot;
            })()
          : messagesRef.current;

      const handleEvent = createStreamEventHandler({
        controller,
        updateArtifact,
        setArtifactIdle,
        appendMessage,
        artifactRef,
        setChatError,
        onConversationCreated,
      });

      const processLine = (line: string) => {
        if (!line) return;
        try {
          const evt = JSON.parse(line) as ChatEvent;
          handleEvent(evt);
        } catch {
          updateArtifact(() => ({
            status: 'error',
            actionState: 'none',
          }));
          setArtifactIdle();
        }
      };

      const run = async () => {
        try {
          const requestBody = buildRequestBodyRef.current({
            input,
            messages: requestMessages,
            conversationId,
          });

          const { body: normalizedBody, stream: shouldStream } = normalizeRequestBody(
            requestBody,
            streamOption,
          );

          if (shouldStream) {
            await startStream({
              url: api,
              body: { ...normalizedBody, stream: true },
              controller,
              headers: defaultChatHeaders,
              onLine: processLine,
            });
          } else {
            updateArtifact(() => ({
              content: '',
              status: 'init',
              actionState: 'pending',
            }));

            if (controller.signal.aborted) return;

            const result = await createTextResponseAction({
              ...toActionRequestPayload(normalizedBody),
              stream: false,
            } as ResponsesCreateParams);

            if (controller.signal.aborted) return;

            if (result.status !== 'success') {
              const message =
                'message' in result && typeof result.message === 'string'
                  ? result.message
                  : 'Text response failed';
              const err = createChatError('upstream', message, {
                provider: 'openai',
              });
              setChatError(err);
              updateArtifact(() => ({
                status: 'error',
                actionState: 'none',
              }));
              // setArtifactIdle();
              return;
            }

            const response = result.response;
            const outputText = extractOutputText(response);
            if (outputText) {
              appendMessage({
                id: crypto.randomUUID(),
                role: 'assistant',
                content: outputText,
                type: 'text',
                logs: [...(artifactRef.current.logs ?? [])],
              });
            }

            setArtifactIdle();
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }

          const message = (err as Error).message ?? 'Unknown stream error';
          const chatErr = createChatError('unknown', message, {
            provider: 'openai',
            raw: err,
          });
          setChatError(chatErr);
        } finally {
          setIsStreaming(false);
          abortRef.current = null;
        }
      };

      void run();
    },
    [
      conversationId,
      setChatError,
      setIsStreaming,
      messagesRef,
      updateArtifact,
      setArtifactIdle,
      appendMessage,
      onConversationCreated,
      streamOption,
      startStream,
      api,
    ],
  );

  useEffect(() => {
    const { lastInput, submissionId } = submitState;
    if (!lastInput) return;

    // avoid re-running the same submission, e.g., on Fast Refresh.
    if (submissionId === lastHandledSubmissionIdRef.current) {
      return;
    }
    lastHandledSubmissionIdRef.current = submissionId;

    startRequest(lastInput, 'new');
  }, [startRequest, submitState]);

  const retry = useCallback(() => {
    if (isStreaming) return;
    const input = lastInputRef.current;
    if (!input) return;
    startRequest(input, 'retry');
  }, [isStreaming, startRequest]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = null;
    setIsStreaming(false);
  }, [setIsStreaming]);

  return {
    messages,
    isStreaming,
    error: chatError,
    submitAction,
    isPending,
    retry,
    stop,
  };
}
