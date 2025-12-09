// src/lib/ai/agents/tools/index.ts
import './calculator';
import './prompt_lookup';
import './prompt/handlers/prompt_search_by_tag';
import './web_search';
import './prompt/handlers/prompt_commit_tool';

export { getToolDefinition, runAgentTool, registerTool } from '@/lib/ai/agents/tools-registry';
