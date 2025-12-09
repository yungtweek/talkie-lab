import NotFound from 'next/dist/client/components/builtin/not-found';

import { resolvePromptVersionId } from '@/app/(prompts)/prompts/prompt-action-helpers';
import { PromptForm } from '@/components/prompt-form';
import {
  getPromptById,
  getPromptMetadata,
  listPromptsByMetadataId,
} from '@/lib/repositories/prompt-repository';

export default async function PromptVersionPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id: metadataId, slug } = await params;

  const metadata = await getPromptMetadata(metadataId);
  if (!metadata) {
    return <NotFound />;
  }

  const versions = await listPromptsByMetadataId(metadataId);
  if (!versions || versions.length === 0) {
    return <NotFound />;
  }

  const targetPromptId = resolvePromptVersionId(slug, versions, metadata.latestVersion?.id);
  if (!targetPromptId) {
    return <NotFound />;
  }

  const prompt = await getPromptById(targetPromptId);
  if (!prompt) {
    return <NotFound />;
  }

  const initial = {
    name: prompt.name ?? '',
    key: prompt.key ?? '',
    description: prompt.description ?? '',
    tags: prompt.tags ?? [],
    content: prompt.version.content ?? '',
    alias: prompt.version.alias ?? '',
    note: prompt.version.note ?? '',
    responseExample: prompt.version.responseExample ?? '',
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Edit Prompt</h1>

      <PromptForm
        metadataId={metadataId}
        promptId={prompt.version.id}
        defaultValues={initial}
        prompts={versions}
        submitLabel="Save"
      />
    </div>
  );
}
