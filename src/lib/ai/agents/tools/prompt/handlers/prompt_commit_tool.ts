import {
  promptCommitTool,
  promptCommitToolSchema,
} from '@/lib/ai/agents/tools/prompt/definitions/prompt_commit.definition';
import { registerTool } from '@/lib/ai/agents/tools-registry';
import { commitPrompt } from '@/lib/repositories/prompt-repository';

registerTool({
  ...promptCommitTool,
  schema: promptCommitToolSchema,
  async execute(rawArgs, _ctx) {
    const parsed = promptCommitToolSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message };
    }

    const data = parsed.data;

    try {
      const result = await commitPrompt({
        metadataId: data.metadataId,
        content: data.content,
        alias: data.alias,
        note: data.note,
        response_example: data.response_example,
      });

      // TODO: Handle commitPrompt returning its own ok/data/error shape defensively
      if (result && typeof result === 'object' && 'ok' in result && (result as any).ok === false) {
        return {
          ok: false,
          error: (result as any).error ?? 'Prompt commit failed',
        };
      }

      return { ok: true, data: result };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message ?? 'Unexpected error while committing prompt',
      };
    }
  },
});
