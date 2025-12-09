import { startTransition, useCallback, useEffect, useRef, useState } from 'react';

import { type ChatError } from '@/lib/errors/chat-error';

export function useChatMessages<TMessage>(conversationId: string, initialMessages?: TMessage[]) {
  const [messages, setMessages] = useState<TMessage[]>(() => initialMessages ?? []);
  const messagesRef = useRef<TMessage[]>([]);

  useEffect(() => {
    // Reset only when the conversation changes to avoid cascades from unstable array identities.
    startTransition(() => {
      setMessages(initialMessages ?? []);
    });
  }, [conversationId, initialMessages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const appendMessage = useCallback((msg: TMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  return { messages, messagesRef, appendMessage };
}

export function useChatStatus() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<ChatError | null>(null);

  return { isStreaming, setIsStreaming, chatError, setChatError };
}
