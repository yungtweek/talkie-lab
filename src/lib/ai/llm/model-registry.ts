// src/lib/llm/model-registry.ts
export const ALLOWED_OPENAI_MODELS = ['gpt-5.1', 'gpt-5.1-codex', 'gpt-4.1', 'o4-mini'] as const;

export type AllowedOpenAIModelName = (typeof ALLOWED_OPENAI_MODELS)[number];

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high';
export const ReasoningEffortLevels: ReasoningEffort[] = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
]; // Full canonical list; individual models may only support a subset via reasoningEfforts

export interface LLMModelInfo {
  name: AllowedOpenAIModelName;
  label: string;
  temperature?: { min: number; max: number; default: number; step?: number };
  topP?: { min: number; max: number; default: number; step?: number };
  maxTokens?: { min: number; max: number; default: number; step?: number };
  reasoningEfforts?: ReasoningEffort[];
}

export function filterAllowedModels(all: string[]): AllowedOpenAIModelName[] {
  return ALLOWED_OPENAI_MODELS.filter(name => all.includes(name));
}

export const OPENAI_MODEL_INFO: Record<AllowedOpenAIModelName, LLMModelInfo> = {
  'gpt-5.1': {
    name: 'gpt-5.1',
    label: 'GPT-5.1',
    reasoningEfforts: ['none', 'low', 'medium', 'high'],
    // temperature: { min: 0, max: 2, default: 1, step: 0.1 },
    topP: { min: 0, max: 1, default: 1, step: 0.01 },
    maxTokens: { min: 256, max: 10240, default: 4096 },
  },

  'gpt-5.1-codex': {
    name: 'gpt-5.1-codex',
    label: 'GPT-5.1 Codex',
    reasoningEfforts: ['none', 'low', 'medium', 'high'],
    topP: { min: 0, max: 1, default: 1, step: 0.01 },
    maxTokens: { min: 256, max: 10240, default: 4096 },
  },

  'gpt-4.1': {
    name: 'gpt-4.1',
    label: 'GPT-4.1',
    temperature: { min: 0, max: 2, default: 1, step: 0.1 },
    topP: { min: 0, max: 1, default: 1, step: 0.01 },
    maxTokens: { min: 256, max: 4096, default: 2048 },
  },

  'o4-mini': {
    name: 'o4-mini',
    label: 'o4-mini',
    reasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high'],
    topP: { min: 0, max: 1, default: 1, step: 0.01 },
    maxTokens: { min: 256, max: 10240, default: 4096 },
  },
};

export function toAllowedModelInfos(all: string[]): LLMModelInfo[] {
  return ALLOWED_OPENAI_MODELS.filter(name => all.includes(name)).map(
    name => OPENAI_MODEL_INFO[name],
  );
}
