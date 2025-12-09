import { z } from 'zod';

import type { ToolSchemaDefinition } from '@/lib/ai/agents/types';

export const promptCommitTool: ToolSchemaDefinition = {
  type: 'function',
  name: 'prompt_commit_tool',
  description: 'Create a new version of an existing prompt metadata with updated content.',
  parameters: {
    type: 'object',
    properties: {
      metadataId: {
        type: 'string',
        description: 'ID of the prompt metadata to which a new version should be attached.',
      },
      content: {
        type: 'string',
        description:
          'Full prompt content for the new version. This should be the complete prompt text, not a diff.',
      },
      alias: {
        type: 'string',
        description: 'Optional alias name for this specific version commit.',
      },
      note: {
        type: 'string',
        description: 'Optional note or description for this version (e.g. what changed).',
      },
      response_example: {
        type: 'string',
        description: 'Optional example response demonstrating expected output for this version.',
      },
    },
    required: ['metadataId', 'content', 'alias', 'note', 'response_example'],
    additionalProperties: false,
  },
  strict: true,
};

export const promptCommitToolSchema = z.object({
  metadataId: z.string().min(1, 'metadataId is required'),
  content: z.string().min(1, 'content is required'),
  alias: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
  response_example: z.string().max(2000).optional(),
});
