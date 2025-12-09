// src/lib/agents/tools-registry.ts
import { promptCommitTool } from '@/lib/ai/agents/tools/prompt/definitions/prompt_commit.definition';
import { promptSearchByTagTool } from '@/lib/ai/agents/tools/prompt/definitions/prompt_search_by_tag.definition';

import {
  type AgentToolContext,
  type AgentToolDefinition,
  type AgentToolName,
  type AgentToolResult,
  type ToolSchemaDefinition,
} from './types';

// TODO: Shared schema defaults usable on client and server
const builtinToolSchemas: Partial<Record<AgentToolName, ToolSchemaDefinition>> = {
  prompt_search_by_tag: promptSearchByTagTool,
  prompt_commit_tool: promptCommitTool,
};

// TODO: Tool registry storage
const toolsRegistry: Partial<Record<AgentToolName, AgentToolDefinition>> = {};
const toolSchemas: Partial<Record<AgentToolName, ToolSchemaDefinition>> = { ...builtinToolSchemas };

// TODO: Helper to register tools
export function registerTool(def: AgentToolDefinition) {
  toolsRegistry[def.name] = def;
  toolSchemas[def.name] = {
    type: def.type,
    name: def.name,
    description: def.description,
    parameters: def.parameters,
    strict: def.strict,
  };
}

/* ----------------- public API ----------------- */

// TODO: Retrieve full runtime tool definition (including execute)
export function getToolDefinition(name: AgentToolName): AgentToolDefinition {
  const def = toolsRegistry[name];
  if (!def) throw new Error(`Tool "${name}" is not registered`);
  return def;
}

export async function runAgentTool(
  name: AgentToolName,
  args: unknown,
  ctx: AgentToolContext = {},
): Promise<AgentToolResult> {
  const tool = getToolDefinition(name);
  if (!tool) {
    return { ok: false, error: `Tool is not registered: ${name}` };
  }
  return tool.execute(args, ctx);
}

// TODO: Return tool schema only (e.g., for exposing toolChoice)
export function getToolSchema(name: AgentToolName): ToolSchemaDefinition | undefined {
  return toolSchemas[name];
}
