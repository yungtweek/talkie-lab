'use client';

import { AlertCircleIcon } from 'lucide-react';
import React from 'react';

import { ArtifactRenderer } from '@/components/artifact-renderer';
import { type RenderableMessage } from '@/components/chat';
import { Greeting } from '@/components/greeting';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type ChatError } from '@/lib/errors/chat-error';

import { ChatMessage, type ChatMessageProps } from './chat-message';

export interface ChatListProps {
  messages: RenderableMessage[];
  selectedMessageId?: string;
  setSelectedMessageId?: (id: string) => void;
  error: ChatError | null;
  onRetry?: () => void;
  isStreaming?: boolean;
}

export default function ChatConversation({
  messages,
  selectedMessageId,
  setSelectedMessageId,
  error,
  onRetry,
  isStreaming,
}: ChatListProps) {
  const toProps = (msg: RenderableMessage): ChatMessageProps => {
    const base = msg as ChatMessageProps;
    return {
      ...base,
    };
  };

  return (
    <div className="relative flex-1 touch-pan-y overflow-y-auto will-change-scroll mx-auto flex min-w-0 max-w-4xl flex-col gap-4 px-4">
      {messages.length === 0 && <Greeting />}
      {messages.map(msg => {
        const props = toProps(msg);
        return (
          <ChatMessage
            key={props.id}
            id={props.id}
            role={props.role}
            content={props.content}
            toolCalls={props.toolCalls}
            logs={props.logs}
            selectedMessageId={selectedMessageId}
            setSelectedMessageId={setSelectedMessageId}
          />
        );
      })}
      <ArtifactRenderer />
      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>
            {error.statusCode ?? ''} {error.type}
          </AlertTitle>
          <AlertDescription>
            <p className="font-mono text-xs whitespace-pre-wrap wrap-break-word">{error.message}</p>
          </AlertDescription>
        </Alert>
      )}
      {error?.retry && onRetry && (
        <Button type={'button'} onClick={onRetry} disabled={isStreaming}>
          {isStreaming ? 'Retrying...' : 'Retry'}
        </Button>
      )}
      <div data-observer-anchor className="h-px w-full" />

      <div data-scroll-sentinel className="min-h-6 min-w-6 shrink-0" />
    </div>
  );
}
