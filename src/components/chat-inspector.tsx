// src/components/chat-inspector.tsx
'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { getModels } from '@/app/(chat)/chat/actions';
import { type RenderableMessage } from '@/components/chat';
import MessageMetricsSection from '@/components/chat/inspectors/message-metrics-section';
import ModelConfigSection from '@/components/chat/inspectors/model-config-section';
import ReasoningConfigSection from '@/components/chat/inspectors/reasoning-config-section';
import SamplingConfigSection from '@/components/chat/inspectors/sampling-config-section';
import SystemPromptSection from '@/components/chat/inspectors/system-prompt-section';
import TokenConfigSection from '@/components/chat/inspectors/token-config-section';
import { useInferenceConfig } from '@/components/inference-config-provider';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { ConversationStateModel } from '@/generated/prisma/models/ConversationState';
import type { LLMModelInfo } from '@/lib/ai/llm/model-registry';
import type { PromptListItem } from '@/lib/repositories/prompt-repository';

interface ChatInspectorProps {
  messages: RenderableMessage[];
  selectedMessageId: string | null;
  initialState?: ConversationStateModel;
  initialPromptData?: {
    metadata: {
      id: string;
      name: string;
      key: string;
      description: string;
      tags: string[];
      latestVersion: {
        id: string;
        version: number;
        alias: string;
        content: string;
        note: string;
        responseExample: string;
        createdAt: Date;
      };
    };
    prompts: PromptListItem[];
  };
}

export function useModelsQuery() {
  return useSuspenseQuery({
    queryKey: ['llm-models'],
    queryFn: getModels,
    staleTime: 5 * 60 * 1000, // 서버 TTL이랑 맞추면 완벽
    refetchOnWindowFocus: false,
  });
}

export default function ChatInspector({
  messages,
  selectedMessageId,
  initialState,
  initialPromptData,
}: ChatInspectorProps) {
  const [error, setError] = useState('');
  const { data: models } = useModelsQuery();
  const cfg = useInferenceConfig();

  const didInitRef = useRef(false);
  const prevModelNameRef = useRef<string | null>(null);

  const applyModelDefaults = useCallback(
    (model?: LLMModelInfo) => {
      if (!model) return;
      if (typeof model.temperature?.default === 'number') {
        cfg.setTemperature(model.temperature.default);
      }
      if (typeof model.topP?.default === 'number') {
        cfg.setTopP(model.topP.default);
      }
      if (typeof model.maxTokens?.default === 'number') {
        cfg.setMaxOutputTokens(model.maxTokens.default);
      }
    },
    [cfg],
  );

  // useEffect(() => {
  //   cfg.setModels(models);
  //   if (models.length > 0) {
  //     cfg.setModel(models[0]);
  //   }
  // }, [models, cfg.setModels, cfg.setModel, cfg]);
  useEffect(() => {
    cfg.setModels(models);
  }, [models, cfg.setModels, cfg]);

  useEffect(() => {
    if (didInitRef.current) return;
    if (!models || models.length === 0) return;

    // ✅ initialState가 있는 경우: 거기서 우선 초기화
    if (initialState) {
      cfg.setTemperature(initialState.temperature ?? 0.3);
      cfg.setTopP(initialState.topP ?? 1);
      cfg.setMaxOutputTokens(initialState.maxOutputTokens);

      // ✅ Page에서 이미 검증된 상태이므로 presence만 확인
      if (
        initialState.promptMetadataId &&
        initialState.promptId &&
        initialPromptData?.prompts?.some(p => p.id === initialState.promptId)
      ) {
        cfg.setPromptMetadataId(initialState.promptMetadataId);
        cfg.setPromptId(initialState.promptId);
      }

      // ✅ Always override with snapshot system prompt text when present
      cfg.setSystemPrompt(initialState.systemPromptText ?? '');

      // ✅ 모델 초기화 유지
      const matchedModel = initialState.model && models.find(m => m.name === initialState.model);

      const nextModel = matchedModel ?? models[0];
      if (nextModel) {
        cfg.setModel(nextModel);
        prevModelNameRef.current = nextModel.name;
      }
    } else {
      // ✅ initialState가 없는 경우: 무조건 첫 모델로 fallback
      if (models[0]) {
        applyModelDefaults(models[0]);
        cfg.setModel(models[0]);
        prevModelNameRef.current = models[0].name;
      }
    }

    didInitRef.current = true;
  }, [applyModelDefaults, cfg, initialState, initialPromptData, models]);

  useEffect(() => {
    const currentModelName = cfg.model?.name ?? null;
    if (!currentModelName) return;

    const previousModelName = prevModelNameRef.current;
    // 첫 초기화 시점의 setModel 호출은 스킵
    if (previousModelName === null) {
      prevModelNameRef.current = currentModelName;
      return;
    }

    if (previousModelName === currentModelName) return;

    prevModelNameRef.current = currentModelName;

    const selectedModel = models.find(m => m.name === currentModelName);
    applyModelDefaults(selectedModel);
  }, [applyModelDefaults, cfg.model?.name, models]);

  useEffect(() => {
    // 메시지 목록이 변경되었을 때 인스펙터에서 반응이 필요하면 여기에서 처리하면 돼.
    // 현재는 props 사용을 위한 placeholder.
  }, [messages]);

  return (
    // <aside className="flex h-screen w-72 flex-col border-l bg-background/80">
    <aside className="relative overscroll-contain flex border-l h-dvh w-72 min-w-0 touch-pan-y flex-col bg-background/80">
      {/* 헤더 - 고정 영역 */}
      <header className="flex items-center justify-between border-b px-4 py-3 sticky top-0 z-10">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Chat inspector</h2>
          {/*<p className="text-xs text-muted-foreground"></p>*/}
        </div>
        {/* 나중에 토글이나 아이콘 넣고 싶으면 여기 */}
      </header>

      {/* 본문 - 여기만 스크롤 */}
      <ScrollArea
        className={
          'flex-1 overscroll-contain overflow-y-auto px-4 py-3 -webkit-overflow-scrolling-touch  touch-pan-y '
        }
      >
        <div className="flex-1 overscroll-contain overflow-y-auto space-y-8">
          {/* 섹션: 모델 선택 */}
          <ModelConfigSection models={models} />

          {/* 섹션: 시스템 프롬프트 설정 */}
          <SystemPromptSection initialPrompts={initialPromptData?.prompts} />
          {/* 섹션: 추론 설정 */}
          <ReasoningConfigSection />
          <SamplingConfigSection />

          {/* 섹션: 토큰 / 기타 옵션 */}
          <TokenConfigSection />
        </div>
      </ScrollArea>

      <div>
        <MessageMetricsSection messages={messages} selectedMessageId={selectedMessageId} />
      </div>

      {/* 푸터 - 고정 영역 */}
      <footer className="border-t px-4 py-2 text-[11px] text-muted-foreground sticky bottom-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <span>Session config</span>
          <span className="text-[10px] opacity-70">auto-save</span>
        </div>
      </footer>
    </aside>
  );
}
