import { listPromptMetadata } from '@/app/(prompts)/prompts/actions';
import { Prompts } from '@/components/prompts';

export default async function PromptsPage() {
  const data = await listPromptMetadata();

  return <Prompts data={data} />;
}
