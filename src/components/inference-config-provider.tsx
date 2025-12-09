'use client';

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import { type AgentMode, type AgentRuntimeConfig } from '@/lib/ai/agents/types';
import {
  type LLMModelInfo,
  type ReasoningEffort,
  ReasoningEffortLevels,
} from '@/lib/ai/llm/model-registry';

export function useReasoningEffortIndex() {
  const { model, reasoningEffort } = useInferenceConfig();
  const levels = model?.reasoningEfforts ?? ReasoningEffortLevels;
  return levels.indexOf(reasoningEffort);
}
export interface InferenceConfigState {
  /**
   * 현재 선택된 모델 정보
   * 사용할 수 있는 모델이 없으면 null
   */
  model: LLMModelInfo | null;
  /**
   * 이 세션에서 선택 가능한 모델 ID 리스트
   * 서버에서 필터링된 allow-list를 주입받는 용도
   */
  models: LLMModelInfo[];
  /**
   * reasoning 모델(o1 계열)용 추론 강도
   * gpt-4.1 계열에서는 무시될 수 있음
   */
  reasoningEffort: ReasoningEffort;
  /**
   * 샘플링 temperature
   * reasoning 모델에서는 사용되지 않을 수 있음
   */
  temperature: number;
  /**
   * nucleus sampling (top-p)
   * temperature와 함께 사용되는 샘플링 파라미터
   */
  topP: number;
  /**
   * 최대 출력 토큰 수 (없으면 undefined)
   */
  maxOutputTokens?: number;
  systemPrompt: string;
  promptMetadataId?: string | null;
  promptId?: string | null;
  agent?: AgentRuntimeConfig;
  chatMode: AgentMode;
  /** Whether to request streaming responses. */
  stream: boolean;
}

export interface InferenceConfigContextValue extends InferenceConfigState {
  setModel: (model: LLMModelInfo | null) => void;
  setModels: (models: LLMModelInfo[]) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setTemperature: (temperature: number) => void;
  setTopP: (topP: number) => void;
  setMaxOutputTokens: (value: number | undefined) => void;
  setSystemPrompt: (prompt: string) => void;
  setPromptMetadataId: (id: string | null | undefined) => void;
  setPromptId: (id: string | null | undefined) => void;
  setAgent: (agent: AgentRuntimeConfig | undefined) => void;
  setChatMode: (mode: AgentMode) => void;
  setStream: (stream: boolean) => void;
}

const InferenceConfigContext = createContext<InferenceConfigContextValue | null>(null);

export const DEFAULT_MAX_OUTPUT_TOKENS = 2048;

export function InferenceConfigProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<LLMModelInfo[]>([]);
  const [model, setModel] = useState<LLMModelInfo | null>(null);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('medium');
  const [temperature, setTemperature] = useState<number>(0.3);
  const [topP, setTopP] = useState<number>(1.0);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | undefined>(
    DEFAULT_MAX_OUTPUT_TOKENS,
  );
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [promptMetadataId, setPromptMetadataId] = useState<string | null | undefined>(undefined);
  const [promptId, setPromptId] = useState<string | null | undefined>(undefined);
  const [agent, setAgent] = useState<AgentRuntimeConfig | undefined>(undefined);
  const [chatMode, setChatMode] = useState<AgentMode>('auto');
  const [stream, setStream] = useState<boolean>(true);

  const value = useMemo<InferenceConfigContextValue>(
    () => ({
      model,
      models,
      reasoningEffort,
      temperature,
      topP,
      maxOutputTokens,
      systemPrompt,
      promptMetadataId,
      promptId,
      agent,
      chatMode,
      stream,
      setModel,
      setModels,
      setReasoningEffort,
      setTemperature,
      setTopP,
      setMaxOutputTokens,
      setSystemPrompt,
      setPromptMetadataId,
      setPromptId,
      setAgent,
      setChatMode,
      setStream,
    }),
    [
      model,
      models,
      reasoningEffort,
      temperature,
      topP,
      maxOutputTokens,
      systemPrompt,
      promptMetadataId,
      promptId,
      agent,
      chatMode,
      stream,
    ],
  );

  return (
    <InferenceConfigContext.Provider value={value}>{children}</InferenceConfigContext.Provider>
  );
}

export function useInferenceConfig(): InferenceConfigContextValue {
  const ctx = useContext(InferenceConfigContext);
  if (!ctx) {
    throw new Error('useInferenceConfig must be used within an InferenceConfigProvider');
  }
  return ctx;
}
