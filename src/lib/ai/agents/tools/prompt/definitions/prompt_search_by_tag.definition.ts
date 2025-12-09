// src/lib/ai/agents/tools/prompt_search_by_tag.definition.ts
import { z } from 'zod';

import type { ToolSchemaDefinition } from '@/lib/ai/agents/types';

export const promptSearchByTagTool: ToolSchemaDefinition = {
  type: 'function',
  name: 'prompt_search_by_tag',
  description: 'Search stored prompts by a single tag and return a list of prompt metadata.',
  parameters: {
    type: 'object',
    properties: {
      tag: {
        type: 'string',
        description: 'Tag name to filter prompts by (e.g. "fun", "system", "agent").',
      },
    },
    required: ['tag'],
    additionalProperties: false,
  },
  strict: true,
};

export const promptSearchByTagSchema = z.object({
  tag: z.string().min(1, 'tag is required'),
  limit: z.number().int().positive().max(20).optional(),
});
