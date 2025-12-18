'use client';

import clsx from 'clsx';
import { ChevronDown, CircleCheck, Copy, WrenchIcon } from 'lucide-react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { type ToolRunSnapshot } from '@/lib/ai/llm/types';

import type { ArtifactLog } from '@/hooks/use-artifact';

export interface ChatMessageProps {
  selectedMessageId?: string;
  setSelectedMessageId?: (id: string) => void;
  id: string;
  role: string;
  content: string;
  toolCalls?: ToolRunSnapshot[];
  logs?: ArtifactLog[];
}

const serializeForCopy = (value: unknown) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const copyToClipboard = async (text: string) => {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
    return;
  } catch {
    // Fallback below.
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    toast.success('Copied to clipboard');
  } catch {
    // ignore
  }
};

export function ChatMessage({
  selectedMessageId,
  setSelectedMessageId,
  id,
  role,
  content,
  toolCalls,
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
        {toolCalls && toolCalls.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {toolCalls.map((call, index) => (
              <Collapsible key={call.id} className="border rounded-md group/collapsible p-2">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex cursor-pointer gap-4 w-full dark:hover:bg-transparent hover:bg-transparent hover:text-inherit"
                    size="sm"
                  >
                    <WrenchIcon />
                    <span className="font-medium">{call.name}</span>
                    <Badge className="ml-auto capitalize" variant="outline">
                      <CircleCheck className="text-green-600" />
                      {call.status}
                    </Badge>
                    <ChevronDown className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="py-5 text-sm">
                  <div className="flex flex-col gap-4 px-2.5 text-sm">
                    <div className="rounded-md border bg-card p-4">
                      <div className="flex items-center gap-2 border-b">
                        <span className="text-sm font-medium">Arguments</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-muted-foreground"
                          onClick={() => copyToClipboard(serializeForCopy(call.args))}
                        >
                          <Copy />
                        </Button>
                      </div>
                      <pre className="p-2 whitespace-pre-wrap wrap-break-word">
                        {JSON.stringify(call.args, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-md border bg-card p-4">
                      <div className="flex items-center gap-2 border-b">
                        <span className="text-sm font-medium">Results</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-muted-foreground"
                          onClick={() => copyToClipboard(serializeForCopy(call.resultPreview))}
                        >
                          <Copy />
                        </Button>
                      </div>
                      <pre className="p-2 whitespace-pre-wrap wrap-break-word">
                        {JSON.stringify(call.resultPreview, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

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
