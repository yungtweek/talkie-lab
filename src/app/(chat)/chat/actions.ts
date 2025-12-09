// app/chat/actions.ts
'use server';

import { auth } from '@/app/(auth)/auth';
import { error, success, type ActionResult, notFound } from '@/lib/action-result';
import { toAllowedModelInfos, type LLMModelInfo } from '@/lib/ai/llm/model-registry';
import { titlePrompt } from '@/lib/ai/llm/prompts';
import { openAIProvider } from '@/lib/ai/llm/providers/openai';
import { generateTextResponse } from '@/lib/ai/llm/router';
import {
  type InputMessage,
  type LLMResponseObject,
  type ResponsesCreateParams,
} from '@/lib/ai/llm/types';
import { extractOutputText } from '@/lib/chat-client';
import {
  findConversationByIdIncludingArchived,
  listConversationsByUser,
  type ListConversationsByUserResult,
} from '@/lib/repositories/conversation-repository';
import { updateConversationArchive } from '@/lib/repositories/conversation-repository';

const MODELS_CACHE_TTL_MS = 300_000; // 5 minutes

interface ModelsCache {
  data: LLMModelInfo[] | null;
  updatedAt: number;
}

const modelsCache: ModelsCache = {
  data: null,
  updatedAt: 0,
};

async function refreshModels(): Promise<LLMModelInfo[]> {
  try {
    const raw = await openAIProvider.getModels();
    const infos = toAllowedModelInfos(raw);
    modelsCache.data = infos;
    modelsCache.updatedAt = Date.now();
    return infos;
  } catch (error) {
    console.error('Failed to fetch models from OpenAI API', error);
    // stale-while-revalidate: if we have old data, keep serving it
    if (modelsCache.data) {
      return modelsCache.data;
    }
    // no cache available, surface empty list to caller
    return [];
  }
}

export async function getModels(): Promise<LLMModelInfo[]> {
  const now = Date.now();
  const isFresh = now - modelsCache.updatedAt < MODELS_CACHE_TTL_MS;

  // Fresh cache available
  if (isFresh && modelsCache.data) {
    return modelsCache.data;
  }

  // Cache is stale but we still have data: return stale immediately and
  // kick off a background refresh.
  if (!isFresh && modelsCache.data) {
    void refreshModels();
    return modelsCache.data;
  }

  // No cache or first load: perform a blocking refresh.
  return refreshModels();
}

export async function createTextResponseAction(
  params: ResponsesCreateParams,
): Promise<ActionResult<{ response: LLMResponseObject }>> {
  try {
    const response = await generateTextResponse(params);
    return success({ response });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate text response from provider';
    return error(message);
  }
}

export async function generateTitleFromUserMessage(
  message: InputMessage,
): Promise<ActionResult<{ title: string }>> {
  try {
    const response = await generateTextResponse({
      model: 'gpt-4.1',
      stream: false,
      systemPrompt: titlePrompt,
      input: [message],
    });

    const title = extractOutputText(response).trim();
    if (!title) {
      return error('Failed to generate title');
    }
    return success({ title });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : 'Failed to generate title';
    return error(messageText);
  }
}

export interface ListConversationsInput {
  cursor?: string | null;
  take?: number;
}

export async function listConversationsAction(
  input?: ListConversationsInput,
): Promise<ListConversationsByUserResult> {
  const { cursor, take = 3 } = input ?? {};

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { items: [], nextCursor: undefined };
  }

  const { items, nextCursor } = await listConversationsByUser(userId, { cursor, take });
  return success({ items, nextCursor });
}

export interface UpdateConversationArchiveActionInput {
  conversationId: string;
  archived: boolean; // true = archive, false = undo
}

export async function updateConversationArchiveAction(
  input: UpdateConversationArchiveActionInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return error('UNAUTHORIZED');
    }

    const chat = await findConversationByIdIncludingArchived(input.conversationId);

    if (!chat || chat.userId !== userId) {
      return notFound(`Couldn't find Chat`);
    }

    // Idempotency guard
    const isAlreadyArchived = Boolean(chat.archivedAt);
    if (isAlreadyArchived === input.archived) {
      return success({ id: chat.id });
    }

    const updated = await updateConversationArchive({
      conversationId: input.conversationId,
      archived: input.archived,
    });

    return success({ id: updated.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update conversation archive state';
    return error(message);
  }
}
