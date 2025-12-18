'use client';
import { usePathname, useRouter } from 'next/navigation';
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useArtifactContext } from '@/components/artifact-provider';
import ChatConversation from '@/components/chat-conversation';
import ChatInspector from '@/components/chat-inspector';
import { useInferenceConfig } from '@/components/inference-config-provider';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { type ConversationStateModel } from '@/generated/prisma/models/ConversationState';
import { useChat, type ChatMessage } from '@/hooks/use-chat';
import { useChatRequestBuilder } from '@/hooks/use-chat-request-params';
import {
  useAssistantSelectionOnScroll,
  useChatScrollAnchors,
  useSelectLatestAssistantMessage,
} from '@/hooks/use-chat-scroll';
// import { useConversationsQuery } from '@/hooks/use-conversations-query';
import { useConversationsQuery } from '@/hooks/use-conversations-query';
import { toChatMetricsViewModel, type ChatMetricsViewModel } from '@/lib/types/chat';

import { ChatInput } from './chat-input';

import type { ChatMessageProps } from '@/components/chat-message';
import type { Message, MessageMetrics } from '@/generated/prisma/client';
import type { ToolRunSnapshot } from '@/lib/ai/llm/types';
import type {
  PromptListItem,
  PromptMetadataWithLatestVersion,
} from '@/lib/repositories/prompt-repository';

export type MessageWithHistory = Message & {
  MessageMetrics?: MessageMetrics[];
  toolCalls?: ToolRunSnapshot[];
};
export type RenderableMessage = ChatMessageProps | MessageWithHistory;

export interface PromptBootstrapData {
  metadata: PromptMetadataWithLatestVersion | null;
  prompts: PromptListItem[];
}

export interface ChatProps {
  conversationId: string;
  initialMessages?: MessageWithHistory[];
  initialState?: ConversationStateModel;
  initialPromptData?: PromptBootstrapData;
}

function serializeFormData(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}

function buildFormData(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value);
  }
  return formData;
}

export function Chat({
  conversationId,
  initialMessages,
  initialState,
  initialPromptData,
}: ChatProps) {
  const router = useRouter();
  const pathname = usePathname();
  const cfg = useInferenceConfig();
  const { artifact } = useArtifactContext();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(() => {
    if (!initialMessages || initialMessages.length === 0) return null;
    const last = initialMessages[initialMessages.length - 1];
    return last.id ?? null;
  });
  const { upsertById, upsert } = useConversationsQuery();

  const mappedInitialMessages: ChatMessage[] | undefined = useMemo(
    () =>
      initialMessages?.map(msg => {
        const metrics = msg.MessageMetrics?.[0];
        const mappedMetrics: ChatMetricsViewModel | undefined = metrics
          ? toChatMetricsViewModel(metrics, {
              messageId: msg.id,
              role: msg.role,
              modelUsed: msg.modelUsed ?? null,
              latencyMs: msg.latencyMs ?? null,
            })
          : undefined;

        return {
          id: msg.id,
          role: msg.role as ChatMessage['role'],
          content: msg.content,
          type: 'text',
          toolCalls: msg.toolCalls,
          messageMetrics: mappedMetrics ? [mappedMetrics] : undefined,
        };
      }),
    [initialMessages],
  );

  const buildRequestBody = useChatRequestBuilder(conversationId, cfg);

  const {
    messages,
    isStreaming,
    error,
    submitAction: rawSubmitAction,
    isPending,
    retry,
  } = useChat(
    buildRequestBody,
    {
      api: '/api/chat',
      stream: cfg.stream,
      conversationId,
      initialMessages: mappedInitialMessages,
      onConversationCreated: conv => {
        upsert(conv);
      },
    },
  );

  const replayedPendingSubmitRef = useRef(false);
  useEffect(() => {
    replayedPendingSubmitRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (replayedPendingSubmitRef.current) return;
    if (typeof window === 'undefined') return;

    const key = `talkie.pendingSubmit:${conversationId}`;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;

    replayedPendingSubmitRef.current = true;
    window.sessionStorage.removeItem(key);

    try {
      const payload = JSON.parse(raw) as Record<string, string>;
      startTransition(() => {
        rawSubmitAction(buildFormData(payload));
      });
    } catch {
      // ignore malformed payloads
    }
  }, [conversationId, rawSubmitAction]);

  const submitAction = useCallback(
    (formData: FormData) => {
      // If we're on `/` (or `/chat`), move to `/chat/:id` before streaming starts.
      // This keeps the homepage URL clean until the user actually uses chat,
      // and avoids mid-stream router navigation which can interrupt streaming.
      const shouldNavigateToConversation =
        pathname === '/' ||
        pathname === '/chat' ||
        (typeof pathname === 'string' &&
          !pathname.startsWith('/chat/') &&
          pathname !== `/chat/${conversationId}`);

      if (shouldNavigateToConversation) {
        try {
          window.sessionStorage.setItem(
            `talkie.pendingSubmit:${conversationId}`,
            JSON.stringify(serializeFormData(formData)),
          );
        } catch {
          // If storage fails, fall back to sending without navigation.
          rawSubmitAction(formData);
          return;
        }

        startTransition(() => {
          router.replace(`/chat/${conversationId}`, { scroll: false });
        });
        return;
      }

      rawSubmitAction(formData);
    },
    [conversationId, pathname, rawSubmitAction, router],
  );

  useSelectLatestAssistantMessage(messages, setSelectedMessageId);

  const handleUiSubmitSideEffect = useCallback(() => {
    if (messages.length === 0) return;

    upsertById(conversationId, {
      lastMessageAt: new Date(),
    });
  }, [conversationId, messages.length, upsertById]);

  const isBusy = useMemo(() => isPending || isStreaming, [isPending, isStreaming]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useChatScrollAnchors(containerRef, artifact, messages);
  useAssistantSelectionOnScroll(containerRef, setSelectedMessageId, isStreaming);

  return (
    <div className="flex">
      <div className="flex-1">
        <div className="overscroll-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
          <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
            <SidebarToggle />
          </header>
          <div
            ref={containerRef}
            className="overscroll-contain -webkit-overflow-scrolling-touch flex-1 touch-pan-y overflow-y-auto"
            style={{ overflowAnchor: 'none' }}
            data-chat-id={conversationId}
          >
            <ChatConversation
              selectedMessageId={selectedMessageId}
              setSelectedMessageId={setSelectedMessageId}
              messages={messages}
              error={error}
              onRetry={retry}
              isStreaming={isStreaming}
            />
          </div>
          <ChatInput
            submitAction={submitAction}
            onSubmitHandler={handleUiSubmitSideEffect}
            isBusy={isBusy}
          />
        </div>
      </div>
      <ChatInspector
        messages={messages}
        selectedMessageId={selectedMessageId}
        initialState={initialState}
        initialPromptData={initialPromptData}
      />
    </div>
  );
}
