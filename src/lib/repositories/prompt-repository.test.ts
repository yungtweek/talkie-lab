import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  promptMetadataCreateMock: vi.fn(),
  promptMetadataUpdateMock: vi.fn(),
  promptCreateMock: vi.fn(),
  promptUpdateMock: vi.fn(),
  promptFindFirstMock: vi.fn(),
  tagFindUniqueMock: vi.fn(),
  tagCreateMock: vi.fn(),
  promptTagCreateMock: vi.fn(),
  promptTagDeleteManyMock: vi.fn(),
  promptFindUniqueMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: async (cb: (tx: any) => Promise<any>) =>
      cb({
        promptMetadata: {
          findMany: mocks.findManyMock,
          create: mocks.promptMetadataCreateMock,
          update: mocks.promptMetadataUpdateMock,
        },
        prompt: {
          create: mocks.promptCreateMock,
          update: mocks.promptUpdateMock,
          findFirst: mocks.promptFindFirstMock,
          findUnique: mocks.promptFindUniqueMock,
        },
        tag: {
          findUnique: mocks.tagFindUniqueMock,
          create: mocks.tagCreateMock,
        },
        promptTag: {
          create: mocks.promptTagCreateMock,
          deleteMany: mocks.promptTagDeleteManyMock,
        },
      }),
    promptMetadata: {
      findMany: mocks.findManyMock,
    },
  },
}));

import {
  commitPrompt,
  createPromptWithMetadata,
  findPromptsByTag,
  listPromptMetadataWithTags,
  updatePrompt,
  updatePromptMetadata,
} from './prompt-repository';

describe('findPromptsByTag', () => {
  beforeEach(() => {
    mocks.findManyMock.mockReset();
    mocks.promptMetadataCreateMock.mockReset();
    mocks.promptMetadataUpdateMock.mockReset();
    mocks.promptCreateMock.mockReset();
    mocks.promptUpdateMock.mockReset();
    mocks.promptFindFirstMock.mockReset();
    mocks.tagFindUniqueMock.mockReset();
    mocks.tagCreateMock.mockReset();
    mocks.promptTagCreateMock.mockReset();
    mocks.promptTagDeleteManyMock.mockReset();
    mocks.promptFindUniqueMock.mockReset();
  });

  it('maps metadata, tags, and latest prompt correctly', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    mocks.findManyMock.mockResolvedValueOnce([
      {
        id: 'm1',
        name: 'Prompt A',
        key: 'key_a',
        description: 'desc',
        promptTags: [{ tag: { name: 'tag1' } }, { tag: { name: 'tag2' } }],
        prompts: [
          {
            id: 'p1',
            version: 2,
            alias: 'latest',
            createdAt,
          },
        ],
      },
      {
        id: 'm2',
        name: 'Prompt B',
        key: 'key_b',
        description: null,
        promptTags: [],
        prompts: [],
      },
    ]);

    const result = await findPromptsByTag('tag1', 2);

    const callArgs = mocks.findManyMock.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({
      where: { isArchived: false, promptTags: { some: { tag: { name: { in: ['tag1'] } } } } },
      take: 3, // limit + 1
    });
    expect(result).toEqual([
      {
        metadata: {
          id: 'm1',
          name: 'Prompt A',
          key: 'key_a',
          description: 'desc',
          tags: ['tag1', 'tag2'],
        },
        latestPrompt: {
          id: 'p1',
          version: 2,
          alias: 'latest',
          createdAt,
        },
      },
      {
        metadata: {
          id: 'm2',
          name: 'Prompt B',
          key: 'key_b',
          description: null,
          tags: [],
        },
        latestPrompt: null,
      },
    ]);
  });

  it('uses default limit when not provided', async () => {
    mocks.findManyMock.mockResolvedValueOnce([
      {
        id: 'm1',
        name: 'Prompt A',
        key: 'key_a',
        description: 'desc',
        promptTags: [],
        prompts: [],
      },
    ]);

    await findPromptsByTag('tagX');

    const callArgs = mocks.findManyMock.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({
      where: { isArchived: false, promptTags: { some: { tag: { name: { in: ['tagX'] } } } } },
      take: 11, // default limit + 1
    });
  });
});

describe('listPromptMetadataWithTags (cursor)', () => {
  beforeEach(() => {
    mocks.findManyMock.mockReset();
  });

  it('applies cursor and take, returns items with nextCursor when full page', async () => {
    const rows = Array.from({ length: 21 }).map((_, idx) => ({
      id: `id-${idx}`,
      name: `name-${idx}`,
      updatedAt: new Date(`2024-01-01T00:00:${idx.toString().padStart(2, '0')}Z`),
      promptTags: [{ tag: { name: 'tagA' } }],
      prompts: [],
    }));
    mocks.findManyMock.mockResolvedValueOnce(rows);

    const result = await listPromptMetadataWithTags({ cursor: 'prev-id', take: 20 });

    expect(mocks.findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 21,
        skip: 1,
        cursor: { id: 'prev-id' },
      }),
    );
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe('id-19');
  });

  it('null nextCursor when less than a full page', async () => {
    const rows = [
      {
        id: 'only-id',
        name: 'name-1',
        updatedAt: new Date(),
        promptTags: [],
        prompts: [],
      },
    ];
    mocks.findManyMock.mockResolvedValueOnce(rows);

    const result = await listPromptMetadataWithTags({ take: 20 });

    expect(result.nextCursor).toBeNull();
    expect(result.items[0]).toMatchObject({ id: 'only-id', name: 'name-1', tags: [] });
  });
});

describe('userId propagation', () => {
  const userId = 'user-123';

  beforeEach(() => {
    mocks.promptMetadataCreateMock.mockReset();
    mocks.promptMetadataUpdateMock.mockReset();
    mocks.promptCreateMock.mockReset();
    mocks.promptUpdateMock.mockReset();
    mocks.promptFindFirstMock.mockReset();
    mocks.tagFindUniqueMock.mockReset();
    mocks.tagCreateMock.mockReset();
    mocks.promptTagCreateMock.mockReset();
  });

  it('createPromptWithMetadata sets createdBy on metadata and prompt', async () => {
    mocks.promptMetadataCreateMock.mockResolvedValueOnce({ id: 'meta1' });
    mocks.promptCreateMock.mockResolvedValueOnce({ id: 'prompt1' });
    mocks.tagFindUniqueMock.mockResolvedValue(null);
    mocks.tagCreateMock.mockImplementation(async ({ data }: any) => ({ id: `tag-${data.name}` }));
    mocks.promptTagCreateMock.mockResolvedValue({});

    const prompt = await createPromptWithMetadata({
      name: 'n',
      key: 'k',
      content: 'c',
      tags: ['tag1'],
      userId,
    });

    expect(prompt.id).toBe('prompt1');
    expect(mocks.promptMetadataCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'n', key: 'k', createdBy: userId }),
    });
    expect(mocks.promptCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadataId: 'meta1', createdBy: userId }),
    });
    expect(mocks.promptTagCreateMock).toHaveBeenCalledWith({
      data: { promptId: 'meta1', tagId: 'tag-tag1' },
    });
  });

  it('updatePromptMetadata sets updatedBy', async () => {
    mocks.promptMetadataUpdateMock.mockResolvedValueOnce({ id: 'meta1' });
    mocks.promptTagDeleteManyMock.mockResolvedValue({});
    mocks.tagFindUniqueMock.mockResolvedValue({ id: 'tag1' });

    await updatePromptMetadata({
      metadataId: 'meta1',
      name: 'new',
      description: 'd',
      tags: [],
      userId,
    });

    expect(mocks.promptMetadataUpdateMock).toHaveBeenCalledWith({
      where: { id: 'meta1' },
      data: expect.objectContaining({ updatedBy: userId }),
    });
  });

  it('commitPrompt and updatePrompt set createdBy/updatedBy', async () => {
    mocks.promptMetadataUpdateMock.mockResolvedValueOnce({ id: 'meta1' });
    mocks.promptFindFirstMock.mockResolvedValueOnce({ version: 1 });
    mocks.promptCreateMock.mockResolvedValueOnce({ id: 'prompt-new', metadataId: 'meta1' });

    await commitPrompt({
      metadataId: 'meta1',
      content: 'content',
      userId,
    });

    expect(mocks.promptMetadataUpdateMock).toHaveBeenCalledWith({
      where: { id: 'meta1' },
      data: expect.objectContaining({ updatedBy: userId }),
    });
    expect(mocks.promptCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdBy: userId }),
      }),
    );

    mocks.promptUpdateMock.mockResolvedValueOnce({ id: 'prompt1', metadataId: 'meta1' });
    mocks.promptMetadataUpdateMock.mockResolvedValueOnce({ id: 'meta1' });

    await updatePrompt({
      promptId: 'prompt1',
      content: 'updated',
      userId,
    });

    expect(mocks.promptUpdateMock).toHaveBeenCalledWith({
      where: { id: 'prompt1' },
      data: expect.objectContaining({ updatedBy: userId }),
      select: expect.anything(),
    });
  });
});
