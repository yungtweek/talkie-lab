import { type z } from 'zod';

export type AgentToolName =
  | 'web_search'
  | 'prompt_lookup'
  | 'calculator'
  | 'prompt_search_by_tag'
  | 'prompt_commit_tool';

export const AGENT_TOOL_NAMES: AgentToolName[] = [
  'web_search',
  'prompt_lookup',
  'calculator',
  'prompt_search_by_tag',
  'prompt_commit_tool',
];

export function isAgentToolName(name: string): name is AgentToolName {
  return AGENT_TOOL_NAMES.includes(name as AgentToolName);
}

export type AgentRole = 'assistant' | 'critic' | 'researcher';

export type AgentPromptVersionStrategy = 'latest' | 'fixed';

export interface AgentPromptBinding {
  metadataId: string;

  versionStrategy: AgentPromptVersionStrategy;

  fixedPromptId?: string | null;
}

export interface AgentModelConfig {
  preferredModel?: string | null;

  reasoningEffort?: 'low' | 'medium' | 'high' | null;
}

export type AgentMode = 'auto' | 'agent' | 'manual';

export interface AgentConfig {
  id: string;

  key: string;

  name: string;
  description?: string;

  role: AgentRole;

  prompt: AgentPromptBinding;

  model: AgentModelConfig;

  tools: AgentToolName[];

  useHistorySummary: boolean;

  isEnabled: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export type AgentRuntimeConfig = Pick<
  AgentConfig,
  'key' | 'name' | 'description' | 'role' | 'useHistorySummary'
> & {
  tools: AgentToolSchema[];
};

export type ResolvedAgentConfig = AgentRuntimeConfig & {
  resolvedPrompt: {
    metadataId: string;
    metadataName: string;
    metadataKey: string;
    promptId: string;
    version: number;
    alias: string | null;
    content: string;
  };
};
export interface AgentToolContext {
  userId?: string | null;
}
export type AgentToolResult = { ok: true; data: unknown } | { ok: false; error: string };

interface ToolJSONSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
      description?: string;
      enum?: string[];
    }
  >;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolSchemaDefinition {
  type: 'function';
  name: AgentToolName;
  description?: string;
  parameters: ToolJSONSchema;
  strict?: boolean;
}

export interface OpenAIWebSearchTool {
  type: 'web_search';
  /**
   * Upstream-specific options. Kept loose to allow future parameters without blocking compilation.
   * See https://platform.openai.com/docs/guides/web-search for details.
   */
  web_search?: {
    search_context_size?: number;
    [key: string]: unknown;
  };
}

export type AgentToolSchema = ToolSchemaDefinition | OpenAIWebSearchTool;

export type AgentToolDefinition = ToolSchemaDefinition & {
  schema: z.ZodTypeAny;
  execute: (args: unknown, ctx: AgentToolContext) => Promise<AgentToolResult>;
};
