'use client';

import clsx from 'clsx';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';

import { Button } from '@/components/ui/button';
import { type ChatMetricsViewModel } from '@/lib/types/chat';

import type { ArtifactLog } from '@/hooks/use-artifact';

export interface ChatMessageProps {
  selectedMessageId?: string;
  setSelectedMessageId?: (id: string) => void;
  id: string;
  role: string;
  content: string;
  logs?: ArtifactLog[];
}

export function ChatMessage({
  selectedMessageId,
  setSelectedMessageId,
  id,
  role,
  content,
  logs,
}: ChatMessageProps) {
  const isUser = role === 'user';

  function handleMessageClick(id: string) {
    if (setSelectedMessageId) {
      setSelectedMessageId(id);
    }
  }

  const selected = selectedMessageId === id;

  if (isUser) {
    return (
      <div role={'user'} className={`flex justify-end`} data-role={role} data-message-id={id}>
        <div className="rounded-lg px-4 py-2 max-w-[75%] bg-primary text-primary-foreground whitespace-pre-wrap wrap-break-word">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      role={'assistant'}
      className="flex justify-start"
      onClick={() => handleMessageClick(id)}
      data-role={role}
      data-message-id={id}
    >
      <div className={clsx('relative px-4 py-2 w-full mb-6 box-border')}>
        {/*{logs && logs.map((log, index) => <p key={index}>{JSON.stringify(log)}</p>)}*/}
        <div className="message-body text-base">
          <ReactMarkdown remarkPlugins={[remarkBreaks]} rehypePlugins={[rehypeSanitize]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
