/* TODO: prompt_lookup tool */
// TODO: Adjust to align with your prompt schema
import { z } from 'zod';

import { registerTool } from '@/lib/ai/agents/tools-registry';
import { prisma } from '@/lib/prisma';

const promptLookupSchema = z.object({
  // TODO: Consider requiring at least one of these identifiers
  metadataId: z.string().uuid().optional(),
  metadataKey: z.string().optional(),
  version: z.number().int().positive().optional(), // 없으면 latest
});

registerTool({
  type: 'function',
  name: 'prompt_lookup',
  description: '저장된 프롬프트를 metadata 기준으로 조회하여 내용과 버전 정보를 반환하는 툴',
  schema: promptLookupSchema,
  parameters: {
    type: 'object',
    properties: {
      metadataId: {
        type: 'string',
        description: 'Prompt metadata UUID (optional)',
      },
      metadataKey: {
        type: 'string',
        description: 'Prompt metadata key (optional)',
      },
      version: {
        type: 'integer',
        description: 'Prompt version to fetch (latest if omitted)',
      },
    },
    // TODO: Enforce "at least one of" in runtime validation (Zod), not JSON Schema
    required: [],
    additionalProperties: false,
  },
  async execute(rawArgs, _ctx) {
    const parsed = promptLookupSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message };
    }
    const { metadataId, metadataKey, version } = parsed.data;

    if (!metadataId && !metadataKey) {
      return {
        ok: false,
        error: 'Either metadataId or metadataKey is required.',
      };
    }

    try {
      // TODO: Step 1: Find metadata
      const metadata = await prisma.promptMetadata.findFirst({
        where: {
          ...(metadataId ? { id: metadataId } : {}),
          ...(metadataKey ? { key: metadataKey } : {}),
        },
        select: {
          id: true,
          name: true,
          key: true,
          description: true,
          // TODO: Pull tag names from the relationship
          promptTags: {
            select: {
              tag: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!metadata) {
        return { ok: false, error: 'Prompt metadata not found.' };
      }

      // TODO: Step 2: Select prompt version (latest if none provided)
      const prompt = await prisma.prompt.findFirst({
        where: {
          metadataId: metadata.id,
          ...(version ? { version } : {}),
        },
        orderBy: version
          ? undefined
          : {
              version: 'desc', // TODO: Default to latest when version is missing
            },
      });

      if (!prompt) {
        return { ok: false, error: 'No prompt found for the given metadata.' };
      }

      return {
        ok: true,
        data: {
          metadata: {
            id: metadata.id,
            name: metadata.name,
            key: metadata.key,
            description: metadata.description,
            tags: metadata.promptTags.map(pt => pt.tag.name),
          },
          prompt: {
            id: prompt.id,
            version: prompt.version,
            alias: prompt.alias,
            content: prompt.content,
            note: prompt.note,
            responseExample: prompt.responseExample,
            createdAt: prompt.createdAt,
          },
        },
      };
    } catch (e) {
      return {
        ok: false,
        error: 'prompt_lookup failed to execute.',
      };
    }
  },
});
