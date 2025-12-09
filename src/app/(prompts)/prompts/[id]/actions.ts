// src/app/(prompts)/prompts/[metadataId]/actions.ts
'use server';

import { runAgentTool } from '@/lib/ai/agents/tools-registry';

export type TestPromptLookupState =
  | { status: 'idle' }
  | { status: 'success'; data: unknown }
  | { status: 'error'; errorMessage: string };

export async function testPromptLookupAction(
  _prevState: TestPromptLookupState,
  formData: FormData,
): Promise<TestPromptLookupState> {
  const metadataId = formData.get('metadataId');
  if (typeof metadataId !== 'string' || metadataId.length === 0) {
    return { status: 'error', errorMessage: 'metadataId가 없습니다.' };
  }

  const result = await runAgentTool(
    'prompt_lookup',
    { metadataId }, // version 안주면 latest
    {},
  );

  if (!result.ok) {
    return { status: 'error', errorMessage: 'unknown error' };
  }

  return { status: 'success', data: result.data };
}
