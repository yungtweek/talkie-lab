// src/app/(prompts)/prompts/new/page.tsx
import React from 'react';

import { PromptForm } from '@/components/prompt-form';

export default function CreatePromptPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Prompt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          재사용 가능한 LLM 프롬프트를 정의하고 버전 관리할 수 있어요.
        </p>
      </div>

      <PromptForm submitLabel="Create" />
    </div>
  );
}
