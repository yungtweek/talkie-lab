import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    messageMetrics: {
      upsert: mocks.upsertMock,
    },
    message: {
      findMany: mocks.findManyMock,
    },
  },
}));

import { type Message, type MessageMetrics, type ToolCall } from '@/generated/prisma/client';

import { listMessagesByConversationId, upsertMessageMetrics } from './conversation-repository';

describe('upsertMessageMetrics', () => {
  beforeEach(() => {
    mocks.upsertMock.mockReset();
    mocks.findManyMock.mockReset();
  });

  it('creates metrics with composite key when not existing', async () => {
    mocks.upsertMock.mockResolvedValue({ id: 'metrics1' });

    const input = {
      messageId: 'm1',
      conversationId: 'c1',
      requestId: 'req1',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    };

    const result = await upsertMessageMetrics(input);

    expect(result).toEqual({ id: 'metrics1' });
    expect(mocks.upsertMock).toHaveBeenCalledWith({
      where: { messageId_requestId: { messageId: 'm1', requestId: 'req1' } },
      create: expect.objectContaining({
        messageId: 'm1',
        conversationId: 'c1',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      }),
      update: expect.objectContaining({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      }),
    });
  });

  it('uses empty requestId when not provided', async () => {
    mocks.upsertMock.mockResolvedValue({ id: 'metrics2' });

    await upsertMessageMetrics({
      messageId: 'm2',
      conversationId: 'c2',
      totalTokens: 5,
    });

    expect(mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messageId_requestId: { messageId: 'm2', requestId: '' } },
      }),
    );
  });

  it('updates existing metrics fields when present', async () => {
    mocks.upsertMock.mockResolvedValue({ id: 'metrics3' });

    await upsertMessageMetrics({
      messageId: 'm3',
      conversationId: 'c3',
      requestId: 'req3',
      latencyMs: 123,
      providerLatencyMs: 50,
      overheadLatencyMs: 73,
      startedAt: new Date('2024-01-01T00:00:00Z'),
      firstTokenAt: new Date('2024-01-01T00:00:01Z'),
      completedAt: new Date('2024-01-01T00:00:02Z'),
      provider: 'openai',
      modelUsed: 'gpt-4.1',
      errorType: 'upstream',
      errorCode: '500',
      errorMessage: 'fail',
    });

    expect(mocks.upsertMock).toHaveBeenCalledWith({
      where: { messageId_requestId: { messageId: 'm3', requestId: 'req3' } },
      create: expect.objectContaining({
        latencyMs: 123,
        providerLatencyMs: 50,
        overheadLatencyMs: 73,
        provider: 'openai',
        modelUsed: 'gpt-4.1',
        errorType: 'upstream',
        errorCode: '500',
        errorMessage: 'fail',
      }),
      update: expect.objectContaining({
        latencyMs: 123,
        providerLatencyMs: 50,
        overheadLatencyMs: 73,
        provider: 'openai',
        modelUsed: 'gpt-4.1',
        errorType: 'upstream',
        errorCode: '500',
        errorMessage: 'fail',
      }),
    });
  });
});

describe('listMessagesByConversationId', () => {
  beforeEach(() => {
    mocks.findManyMock.mockReset();
  });

  it('overrides token fields with latest metrics when available', async () => {
    const message = {
      id: 'm1',
      position: BigInt(1),
      conversationId: 'c1',
      role: 'assistant',
      content: 'hi',
      createdAt: new Date(),
      // fallbacks
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3,
      toolCalls: [],
      MessageMetrics: [
        {
          id: 'metric1',
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        } as MessageMetrics,
      ],
    } as unknown as Message & { MessageMetrics: MessageMetrics[]; toolCalls: ToolCall[] };

    mocks.findManyMock.mockResolvedValue([message]);

    const result = await listMessagesByConversationId('c1');
    expect(mocks.findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'c1' },
        include: {
          MessageMetrics: { orderBy: [{ createdAt: 'desc' }] },
          toolCalls: { orderBy: [{ createdAt: 'asc' }] },
        },
      }),
    );
    expect(result[0].promptTokens).toBe(10);
    expect(result[0].completionTokens).toBe(20);
    expect(result[0].totalTokens).toBe(30);
  });

  it('falls back to message token fields when no metrics exist', async () => {
    const message = {
      id: 'm2',
      position: BigInt(2),
      conversationId: 'c1',
      role: 'assistant',
      content: 'no metrics',
      createdAt: new Date(),
      promptTokens: 5,
      completionTokens: 6,
      totalTokens: 11,
      toolCalls: [],
      MessageMetrics: [],
    } as unknown as Message & { MessageMetrics: MessageMetrics[]; toolCalls: ToolCall[] };

    mocks.findManyMock.mockResolvedValue([message]);

    const result = await listMessagesByConversationId('c1');
    expect(result[0].promptTokens).toBe(5);
    expect(result[0].completionTokens).toBe(6);
    expect(result[0].totalTokens).toBe(11);
  });

  it('maps toolCalls history into ToolRunSnapshot toolCalls', async () => {
    const message = {
      id: 'm3',
      position: BigInt(3),
      conversationId: 'c1',
      role: 'assistant',
      content: 'tools',
      createdAt: new Date(),
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      toolCalls: [
        {
          id: 'tc1',
          messageId: 'm3',
          toolCallId: 'fc_1',
          toolName: 'calculator',
          callId: 'call_1',
          arguments: { expression: '1+1' },
          result: { value: 2 },
          status: 'succeeded',
          createdAt: new Date(),
        } as unknown as ToolCall,
      ],
      MessageMetrics: [],
    } as unknown as Message & { MessageMetrics: MessageMetrics[]; toolCalls: ToolCall[] };

    mocks.findManyMock.mockResolvedValue([message]);

    const result = await listMessagesByConversationId('c1');
    expect(result[0].toolCalls).toEqual([
      {
        id: 'call_1',
        functionCallId: 'fc_1',
        name: 'calculator',
        status: 'completed',
        args: { expression: '1+1' },
        resultPreview: { value: 2 },
      },
    ]);
  });
});
