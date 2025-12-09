/* TODO: web_search tool placeholder */

import { z } from 'zod';

import { registerTool } from '@/lib/ai/agents/tools-registry';
import { type ToolSchemaDefinition } from '@/lib/ai/agents/types';

const webSearchSchema = z.object({
  query: z.string().min(1),
});

export const webSearchTool: ToolSchemaDefinition = {
  type: 'function',
  name: 'web_search',
  description: 'External search (TODO: not implemented yet)',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query string to search',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
};

registerTool({
  ...webSearchTool,
  schema: webSearchSchema,
  async execute(_rawArgs, _ctx) {
    return {
      ok: false,
      error: 'web_search tool is not implemented yet.',
    };
  },
});
