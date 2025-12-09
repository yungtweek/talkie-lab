import NotFound from 'next/dist/client/components/builtin/not-found';

import { getPromptMetadataAction } from '@/app/(prompts)/prompts/actions';
import { PromptForm } from '@/components/prompt-form';

export default async function PromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: metadataId } = await params;

  const state = await getPromptMetadataAction(metadataId);

  if (state.status !== 'success' || !state.data?.metadata || !state.data.metadata.latestVersion) {
    return <NotFound />;
  }

  const { metadata, prompts } = state.data;
  const latest = metadata.latestVersion;

  const initial =
    state.status === 'success' && metadata
      ? {
          name: metadata.name,
          key: metadata.key,
          content: metadata.latestVersion?.content ?? '',
          tags: metadata.tags ?? [],
          description: metadata.description ?? '',
          responseExample: undefined,
        }
      : null;

  const promptId = latest?.id;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Edit Prompt</h1>

      {initial && state.status === 'success' && (
        <PromptForm
          metadataId={metadataId}
          promptId={promptId}
          defaultValues={initial}
          prompts={prompts}
          submitLabel="Save"
        />
      )}
    </div>
  );
}
