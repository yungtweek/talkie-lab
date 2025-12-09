// src/lib/repositories/prompt-repository.ts
import { type Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export async function createPromptWithMetadata(input: {
  name: string;
  key: string;
  description?: string | null;
  tags?: string[];
  content: string;
  alias?: string | null;
  note?: string;
  response_example?: string;
  userId?: string;
}) {
  const {
    name,
    key,
    description,
    tags = [],
    content,
    alias = null,
    note = null,
    response_example = null,
    userId = null,
  } = input;

  return prisma.$transaction(async tx => {
    const metadata = await tx.promptMetadata.create({
      data: { name, key, description: description ?? null, createdBy: userId },
    });

    const prompt = await tx.prompt.create({
      data: {
        metadataId: metadata.id,
        version: 1,
        content,
        alias,
        note,
        responseExample: response_example,
        createdBy: userId,
      },
    });

    for (const tagName of tags) {
      let tag = await tx.tag.findUnique({ where: { name: tagName } });

      if (!tag) {
        tag = await tx.tag.create({ data: { name: tagName } });
      }

      await tx.promptTag.create({
        data: {
          promptId: metadata.id,
          tagId: tag.id,
        },
      });
    }

    return prompt;
  });
}

export async function updatePromptMetadata(input: {
  metadataId: string;
  name: string;
  description?: string | null;
  tags?: string[];
  userId?: string;
}) {
  const { metadataId, name, description, tags = [], userId = null } = input;

  return prisma.$transaction(async tx => {
    const metadata = await tx.promptMetadata.update({
      where: { id: metadataId },
      data: {
        name,
        description: description ?? null,
        updatedAt: new Date(),
        updatedBy: userId,
      },
    });

    await tx.promptTag.deleteMany({
      where: { promptId: metadata.id },
    });

    for (const tagName of tags) {
      let tag = await tx.tag.findUnique({ where: { name: tagName } });

      if (!tag) {
        tag = await tx.tag.create({ data: { name: tagName } });
      }

      await tx.promptTag.create({
        data: {
          promptId: metadata.id,
          tagId: tag.id,
        },
      });
    }

    return { metadata };
  });
}

export async function commitPrompt(input: {
  metadataId: string;
  content: string;
  alias?: string;
  note?: string;
  response_example?: string;
  userId?: string;
}) {
  const {
    metadataId,
    content,
    alias = null,
    note = null,
    response_example = null,
    userId = null,
  } = input;

  return prisma.$transaction(async tx => {
    const metadata = await tx.promptMetadata.update({
      where: { id: metadataId },
      data: {
        updatedAt: new Date(),
        updatedBy: userId,
      },
    });

    const latest = await tx.prompt.findFirst({
      where: { metadataId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (latest?.version ?? 0) + 1;

    const prompt = await tx.prompt.create({
      data: {
        metadataId,
        version: nextVersion,
        content,
        alias,
        note,
        responseExample: response_example,
        createdBy: userId,
      },
    });

    return { metadata, prompt };
  });
}

export async function updatePrompt(input: {
  promptId: string;
  content: string;
  alias?: string | null;
  note?: string | null;
  response_example?: string | null;
  userId?: string;
}) {
  const {
    promptId,
    content,
    alias = null,
    note = null,
    response_example = null,
    userId = null,
  } = input;

  return prisma.$transaction(async tx => {
    const prompt = await tx.prompt.update({
      where: { id: promptId },
      data: {
        content,
        alias,
        note,
        responseExample: response_example,
        updatedBy: userId,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        metadataId: true,
        version: true,
        alias: true,
        content: true,
        note: true,
        responseExample: true,
        createdAt: true,
      },
    });

    const metadata = await tx.promptMetadata.update({
      where: { id: prompt.metadataId },
      data: {
        updatedAt: new Date(),
      },
    });

    return { metadata, prompt };
  });
}

export async function listPromptMetadataWithTags(opts?: { cursor?: string; take?: number }) {
  const take = opts?.take ?? 20;
  const cursor = opts?.cursor;

  const { items, nextCursor } = await searchPromptMetadata({
    take,
    cursor,
  });

  return {
    items: items.map(item => ({
      id: item.metadata.id,
      name: item.metadata.name,
      updatedAt: item.metadata.updatedAt,
      tags: item.metadata.tags,
    })),
    nextCursor,
  };
}

export interface SearchPromptOptions {
  query?: string;
  tags?: string[];
  cursor?: string;
  take?: number;
}

export async function searchPromptMetadata(opts: SearchPromptOptions) {
  const { query, tags = [], cursor, take = 20 } = opts ?? {};

  const where: Prisma.PromptMetadataWhereInput = {
    isArchived: false,
  };

  if (query && query.trim() !== '') {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { key: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      {
        promptTags: {
          some: {
            tag: {
              name: { contains: query, mode: 'insensitive' },
            },
          },
        },
      },
    ];
  }

  if (tags.length > 0) {
    where.promptTags = {
      some: {
        tag: {
          name: { in: tags },
        },
      },
    };
  }

  const takePlusOne = take + 1;

  const rows = await prisma.promptMetadata.findMany({
    where,
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      updatedAt: true,
      promptTags: {
        select: {
          tag: {
            select: { name: true },
          },
        },
      },
      prompts: {
        select: {
          id: true,
          version: true,
          alias: true,
          createdAt: true,
        },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: takePlusOne,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = rows.length > take;
  const slice = hasMore ? rows.slice(0, take) : rows;

  const items = slice.map(row => ({
    metadata: {
      id: row.id,
      name: row.name,
      key: row.key,
      description: row.description,
      updatedAt: row.updatedAt,
      tags: row.promptTags.map(pt => pt.tag.name),
    },
    latestPrompt: row.prompts[0]
      ? {
          id: row.prompts[0].id,
          version: row.prompts[0].version,
          alias: row.prompts[0].alias,
          createdAt: row.prompts[0].createdAt,
        }
      : null,
  }));

  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
}

export async function listAllPromptTags() {
  const rows = await prisma.tag.findMany({
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return rows.map(r => r.name);
}

export interface PromptListItem {
  id: string;
  version: number;
  alias: string | null;
  createdAt: Date;
}

export async function listPromptsByMetadataId(metadataId: string): Promise<PromptListItem[]> {
  return prisma.prompt.findMany({
    where: {
      metadataId,
      metadata: {
        isArchived: false, // prevent fetching prompts of archived metadata
      },
    },
    select: {
      id: true,
      version: true,
      alias: true,
      createdAt: true,
    },
    orderBy: { version: 'desc' },
  });
}

export async function findPromptsByTag(tag: string, limit = 10) {
  const { items } = await searchPromptMetadata({
    tags: [tag],
    take: limit,
  });

  return items;
}

export async function getPromptById(promptId: string) {
  const row = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      version: true,
      content: true,
      alias: true,
      note: true,
      responseExample: true,
      createdAt: true,
      metadata: {
        select: {
          id: true,
          name: true,
          key: true,
          description: true,
          promptTags: {
            select: { tag: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!row || !row.metadata) {
    return null;
  }

  const metadata = row.metadata;

  return {
    id: metadata.id,
    name: metadata.name,
    key: metadata.key,
    description: metadata.description,
    tags: metadata.promptTags.map(pt => pt.tag.name),
    version: {
      id: row.id,
      version: row.version,
      content: row.content,
      alias: row.alias,
      note: row.note,
      responseExample: row.responseExample,
      createdAt: row.createdAt,
    },
  };
}

export interface PromptMetadataLatestVersion {
  id: string;
  version: number;
  alias: string | null;
  content: string;
  note: string | null;
  responseExample: string | null;
  createdAt: Date;
}

export interface PromptMetadataWithLatestVersion {
  id: string;
  name: string;
  key: string;
  description: string | null;
  tags: string[];
  latestVersion: PromptMetadataLatestVersion | null;
}

export async function getPromptMetadata(
  metadataId: string,
): Promise<PromptMetadataWithLatestVersion | null> {
  const branch = await prisma.promptMetadata.findFirst({
    where: { id: metadataId, isArchived: false },
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      promptTags: {
        select: { tag: { select: { name: true } } },
      },
      prompts: {
        select: {
          id: true,
          version: true,
          alias: true,
          content: true,
          note: true,
          responseExample: true,
          createdAt: true,
        },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  if (!branch) {
    return null;
  }

  const latest = branch.prompts[0] ?? null;

  return {
    id: branch.id,
    name: branch.name,
    key: branch.key,
    description: branch.description,
    tags: branch.promptTags.map(pt => pt.tag.name),
    latestVersion: latest
      ? {
          id: latest.id,
          version: latest.version,
          alias: latest.alias,
          content: latest.content,
          note: latest.note,
          responseExample: latest.responseExample,
          createdAt: latest.createdAt,
        }
      : null,
  };
}

export async function archivePromptMetadata(metadataId: string, userId?: string) {
  return prisma.promptMetadata.update({
    where: { id: metadataId },
    data: {
      isArchived: true,
      updatedBy: userId ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function unarchivePromptMetadata(metadataId: string, userId?: string) {
  return prisma.promptMetadata.update({
    where: { id: metadataId },
    data: {
      isArchived: false,
      updatedBy: userId ?? null,
      updatedAt: new Date(),
    },
  });
}
