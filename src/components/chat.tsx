'use client';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import {
  type getPromptMetadata,
  type listPromptsByMetadataId,
  type PromptListItem,
} from '@/lib/repositories/prompt-repository';
import { toChatMetricsViewModel, type ChatMetricsViewModel } from '@/lib/types/chat';

import { ChatInput } from './chat-input';

import type { ChatMessageProps } from '@/components/chat-message';
import type { Message, MessageMetrics } from '@/generated/prisma/client';

export type MessageWithMetrics = Message & { MessageMetrics?: MessageMetrics[] };
export type RenderableMessage = ChatMessageProps | MessageWithMetrics;

export interface ChatProps {
  conversationId: string;
  initialMessages?: MessageWithMetrics[];
  initialState?: ConversationStateModel;
  initialPromptData?: {
    metadata: {
      id: string;
      name: string;
      key: string;
      description: string;
      tags: string[];
      latestVersion: {
        id: string;
        version: number;
        alias: string;
        content: string;
        note: string;
        responseExample: string;
        createdAt: Date;
      };
    };
    prompts: PromptListItem[];
  };
}

export function Chat({ conversationId, initialMessages, initialState, initialPromptData }: ChatProps) {
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
          messageMetrics: mappedMetrics ? [mappedMetrics] : undefined,
        };
      }),
    [initialMessages],
  );

  const buildRequestBody = useChatRequestBuilder(conversationId, cfg);

  const { messages, isStreaming, error, submitAction, isPending, retry } = useChat(buildRequestBody, {
    api: '/api/chat',
    stream: cfg.stream,
    conversationId,
    initialMessages: mappedInitialMessages,
    onConversationCreated: conv => {
      window.history.replaceState({}, '', `/chat/${conv.id}`);
      upsert(conv);
    },
  });

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
          <ChatInput submitAction={submitAction} onSubmitHandler={handleUiSubmitSideEffect} isBusy={isBusy} />
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
