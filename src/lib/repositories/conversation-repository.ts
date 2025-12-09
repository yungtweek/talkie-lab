import {
  type Conversation,
  type Message,
  type MessageMetrics,
  type Prisma,
  type ToolCall,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export async function findConversationById(id: string) {
  return prisma.conversation.findUnique({
    where: {
      id,
      deletedAt: null,
      archivedAt: null,
    },
  });
}

export async function findConversationByIdIncludingArchived(id: string) {
  return prisma.conversation.findUnique({
    where: {
      id,
      deletedAt: null,
    },
  });
}

export async function findConversationStateByConversationId(conversationId: string) {
  return prisma.conversationState.findUnique({
    where: {
      conversationId, // relies on @unique constraint
    },
  });
}

export interface CreateConversationInput {
  id?: string;
  userId?: string | null;
  title?: string | null;
  model?: string | null;
  metadata?: Prisma.JsonValue;
  visibility?: 'private' | 'shared';
  shareId?: string | null;
}

export async function createConversation(input: CreateConversationInput) {
  const { id, userId, title, model, metadata, visibility, shareId } = input;

  return prisma.conversation.create({
    data: {
      ...(id ? { id } : {}),
      ...(userId ? { user: { connect: { id: userId } } } : {}),
      title: title ?? null,
      model: model ?? null,
      metadata: metadata ?? undefined,
      visibility,
      shareId: shareId ?? null,
    },
  });
}

export interface CreateMessageInput {
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string;
  turn?: number | null;
  indexInTurn?: number | null;
  metadata?: Prisma.JsonValue;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  mode?: string | null;
  provider?: string | null;
  modelUsed?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  error?: string | null;
}

export async function createMessage(input: CreateMessageInput) {
  const {
    conversationId,
    role,
    content,
    turn,
    indexInTurn,
    metadata,
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    mode,
    provider,
    modelUsed,
    requestId,
    traceId,
    error,
  } = input;

  return prisma.message.create({
    data: {
      conversation: { connect: { id: conversationId } },
      role,
      content,
      turn: turn ?? null,
      indexInTurn: indexInTurn ?? null,
      metadata: metadata ?? undefined,
      latencyMs: latencyMs ?? null,
      promptTokens: promptTokens ?? null,
      completionTokens: completionTokens ?? null,
      totalTokens: totalTokens ?? null,
      mode: mode ?? null,
      provider: provider ?? null,
      modelUsed: modelUsed ?? null,
      requestId: requestId ?? null,
      traceId: traceId ?? null,
      error: error ?? null,
    },
  });
}

export async function listMessagesByConversationId(
  conversationId: string,
  opts?: { take?: number },
): Promise<Array<Message & { MessageMetrics?: MessageMetrics[] }>> {
  const take = opts?.take;
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ position: 'asc' }],
    ...(typeof take === 'number' ? { take } : {}),
    include: {
      MessageMetrics: {
        orderBy: [{ createdAt: 'desc' }],
      },
    },
  });

  return messages.map(msg => {
    const metrics = msg.MessageMetrics?.[0];
    if (!metrics) return msg;

    return {
      ...msg,
      promptTokens: metrics.promptTokens ?? msg.promptTokens,
      completionTokens: metrics.completionTokens ?? msg.completionTokens,
      totalTokens: metrics.totalTokens ?? msg.totalTokens,
    };
  });
}

export async function getNextTurn(conversationId: string): Promise<number> {
  const last = await prisma.message.findFirst({
    where: { conversationId, turn: { not: null } },
    orderBy: [{ turn: 'desc' }],
    select: { turn: true },
  });

  const lastTurn = typeof last?.turn === 'number' ? last.turn : 0;
  return lastTurn + 1;
}

export interface ListConversationsByUserOptions {
  cursor?: string | null;
  take?: number;
}

export interface ListConversationsByUserResult {
  items: Conversation[];
  nextCursor?: string;
}

export async function listConversationsByUser(
  userId: string,
  opts?: ListConversationsByUserOptions,
): Promise<ListConversationsByUserResult> {
  const take = opts?.take ?? 20;
  const cursor = opts?.cursor;

  const items = await prisma.conversation.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ lastMessageAt: 'desc' }],
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasNext = items.length > take;
  const data = hasNext ? items.slice(0, take) : items;
  const nextCursor = hasNext ? data[data.length - 1]?.id : undefined;

  return { items: data, nextCursor };
}

export interface UpdateConversationArchiveInput {
  conversationId: string;
  archived: boolean; // true = archive, false = undo (un-archive)
}

export async function updateConversationArchive(input: UpdateConversationArchiveInput) {
  const { conversationId, archived } = input;

  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      archivedAt: archived ? new Date() : null,
    },
  });
}

export interface UpdateConversationLastMessageAtInput {
  conversationId: string;
  lastMessageAt?: Date | null; // default: now
}

export async function updateConversationLastMessageAt(input: UpdateConversationLastMessageAtInput) {
  const { conversationId, lastMessageAt } = input;

  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: lastMessageAt ?? new Date(),
    },
  });
}

export interface UpsertConversationStateInput {
  conversationId: string; // unique FK

  model?: string | null;

  // system prompt (direct text snapshot)
  systemPromptText?: string | null;

  // prompt reference (optional)
  promptMetadataId?: string | null;
  promptId?: string | null;

  // sampling / reasoning
  reasoningEffort?: string | null;
  temperature?: number | null;
  topP?: number | null;
  maxOutputTokens?: number | null;
}

export async function upsertConversationState(input: UpsertConversationStateInput) {
  const {
    conversationId,
    model,
    systemPromptText,
    promptMetadataId,
    promptId,
    reasoningEffort,
    temperature,
    topP,
    maxOutputTokens,
  } = input;

  return prisma.conversationState.upsert({
    where: {
      conversationId, // relies on @unique constraint
    },
    create: {
      conversationId,
      model: model ?? undefined,
      systemPromptText: systemPromptText ?? undefined,
      promptMetadataId: promptMetadataId ?? undefined,
      promptId: promptId ?? undefined,
      reasoningEffort: reasoningEffort ?? undefined,
      temperature: temperature ?? undefined,
      topP: topP ?? undefined,
      maxOutputTokens: maxOutputTokens ?? undefined,
    },
    update: {
      model,
      systemPromptText,
      promptMetadataId,
      promptId,
      reasoningEffort,
      temperature,
      topP,
      maxOutputTokens,
    },
  });
}

export interface UpsertToolCallInput {
  messageId: string;
  toolCallId?: string | null;
  toolName: string;
  callId?: string | null;
  arguments?: Prisma.JsonValue | null;
  result?: Prisma.JsonValue | null;
  status?: string | null;
}

export async function upsertToolCall(input: UpsertToolCallInput) {
  const { messageId, toolName, callId, toolCallId, arguments: args, result, status } = input;

  const existing = await prisma.toolCall.findFirst({
    where: {
      messageId,
      callId: callId ?? null,
      toolCallId: toolCallId ?? null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (existing) {
    return prisma.toolCall.update({
      where: {
        id: existing.id,
      },
      data: {
        toolName,
        callId: callId ?? null,
        toolCallId: toolCallId ?? null,
        arguments: args ?? undefined,
        result: result ?? undefined,
        status: status ?? null,
      },
    });
  }

  return prisma.toolCall.create({
    data: {
      messageId,
      toolName,
      callId: callId ?? null,
      toolCallId: toolCallId ?? null,
      arguments: args ?? undefined,
      result: result ?? undefined,
      status: status ?? null,
    },
  });
}

export interface UpsertMessageMetricsInput {
  messageId: string; // FK
  conversationId: string; // FK
  requestId?: string | null;
  traceId?: string | null;

  // timing
  latencyMs?: number | null;
  providerLatencyMs?: number | null;
  overheadLatencyMs?: number | null;
  startedAt?: Date | null;
  firstTokenAt?: Date | null;
  completedAt?: Date | null;

  reasoningEffort?: string | null;
  temperature?: number | null;
  topP?: number | null;
  maxOutputTokens?: number | null;

  // tokens
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;

  // other metadata
  provider?: string | null;
  modelUsed?: string | null;
  errorType?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export async function upsertMessageMetrics(input: UpsertMessageMetricsInput) {
  const {
    messageId,
    conversationId,
    requestId,
    traceId,
    latencyMs,
    providerLatencyMs,
    overheadLatencyMs,
    startedAt,
    firstTokenAt,
    completedAt,
    reasoningEffort,
    temperature,
    topP,
    maxOutputTokens,
    promptTokens,
    completionTokens,
    totalTokens,
    provider,
    modelUsed,
    errorType,
    errorCode,
    errorMessage,
  } = input;

  return prisma.messageMetrics.upsert({
    where: {
      // composite unique constraint를 추천:
      // @@unique([messageId, requestId])
      messageId_requestId: {
        messageId,
        requestId: requestId ?? '',
      },
    },
    create: {
      messageId,
      conversationId,
      requestId,
      traceId,
      latencyMs,
      providerLatencyMs,
      overheadLatencyMs,
      startedAt,
      firstTokenAt,
      completedAt,
      reasoningEffort,
      temperature,
      topP,
      maxOutputTokens,
      promptTokens,
      completionTokens,
      totalTokens,
      provider,
      modelUsed,
      errorType,
      errorCode,
      errorMessage,
    },
    update: {
      // undefined로 넣으면 Prisma가 field update를 skip함 → 안전함
      requestId,
      traceId,
      latencyMs,
      providerLatencyMs,
      overheadLatencyMs,
      startedAt,
      firstTokenAt,
      completedAt,
      promptTokens,
      completionTokens,
      reasoningEffort,
      temperature,
      topP,
      maxOutputTokens,
      totalTokens,
      provider,
      modelUsed,
      errorType,
      errorCode,
      errorMessage,
    },
  });
}
