'use client';

import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  listConversationsAction,
  updateConversationArchiveAction,
} from '@/app/(chat)/chat/actions';
import { type ListConversationsByUserResult } from '@/lib/repositories/conversation-repository';

export type ConversationItem = ListConversationsByUserResult['items'][number];

/**
 * Shared conversation list query + client-side cache helpers.
 * Keeps pagination data (loadMore) intact across routes thanks to persisted queries.
 */
export function useConversationsQuery() {
  const queryClient = useQueryClient();

  const listQuery = useSuspenseQuery(
    queryOptions({
      queryKey: ['conversations'],
      queryFn: async () => listConversationsAction(),
      refetchOnMount: false,
    }),
  );

  const upsert = useCallback(
    (conv: ConversationItem, restoreIndex?: number) => {
      queryClient.setQueryData<ListConversationsByUserResult | undefined>(
        ['conversations'],
        prev => {
          if (!prev) {
            return { items: [conv], nextCursor: undefined };
          }

          // TODO: When undoing, reinsert the conversation at its previous index
          if (typeof restoreIndex === 'number' && restoreIndex >= 0) {
            const nextItems = [...prev.items];
            nextItems.splice(restoreIndex, 0, conv);

            return {
              ...prev,
              items: nextItems,
            };
          }

          const index = prev.items.findIndex(item => item.id === conv.id);

          // TODO: If the item exists already, update it in place
          if (index !== -1) {
            const nextItems = [...prev.items];
            nextItems[index] = conv;

            return {
              ...prev,
              items: nextItems,
            };
          }

          // TODO: Only prepend when the conversation is new
          return {
            ...prev,
            items: [conv, ...prev.items],
          };
        },
      );
    },
    [queryClient],
  );

  // TODO: Upsert when only conversationId is available (Chat page)
  const upsertById = useCallback(
    (conversationId: string, patch?: Partial<ConversationItem>) => {
      queryClient.setQueryData<ListConversationsByUserResult | undefined>(
        ['conversations'],
        prev => {
          if (!prev) return prev;

          const index = prev.items.findIndex(item => item.id === conversationId);
          if (index === -1) return prev;

          const current = prev.items[index];
          const next = { ...current, ...patch };

          // TODO: If already at the top, just patch the value (keep order)
          if (index === 0) {
            const nextItems = [...prev.items];
            nextItems[0] = next;

            return {
              ...prev,
              items: nextItems,
            };
          }

          // TODO: If not at the top, move the item to the front after patching
          const without = prev.items.filter(item => item.id !== conversationId);
          const nextItems = [next, ...without];

          return {
            ...prev,
            items: nextItems,
          };
        },
      );
    },
    [queryClient],
  );

  const remove = useCallback(
    (id: string) => {
      queryClient.setQueryData<ListConversationsByUserResult | undefined>(
        ['conversations'],
        prev =>
          prev
            ? {
                ...prev,
                items: prev.items.filter(item => item.id !== id),
              }
            : prev,
      );
    },
    [queryClient],
  );

  // TODO: Load more using nextCursor
  const loadMore = useCallback(async () => {
    const prev = queryClient.getQueryData<ListConversationsByUserResult>(['conversations']);
    if (!prev?.nextCursor) return;

    const next = await listConversationsAction({ cursor: prev.nextCursor });

    queryClient.setQueryData<ListConversationsByUserResult>(['conversations'], current =>
      current
        ? {
            ...current,
            items: [...current.items, ...next.items],
            nextCursor: next.nextCursor,
          }
        : next,
    );
  }, [queryClient]);

  const archive = useCallback(async (conversationId: string, archived: boolean) => {
    await updateConversationArchiveAction({ conversationId, archived });
  }, []);

  return { ...listQuery, upsert, upsertById, remove, loadMore, archive };
}
