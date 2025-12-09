/* TODO: prompt_search_by_tag tool */
import {
  promptSearchByTagSchema,
  promptSearchByTagTool,
} from '@/lib/ai/agents/tools/prompt/definitions/prompt_search_by_tag.definition';
import { registerTool } from '@/lib/ai/agents/tools-registry';
import { findPromptsByTag } from '@/lib/repositories/prompt-repository';

registerTool({
  ...promptSearchByTagTool,
  schema: promptSearchByTagSchema,
  async execute(rawArgs, _ctx) {
    const parsed = promptSearchByTagSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message };
    }

    const { tag, limit } = parsed.data;

    try {
      const items = await findPromptsByTag(tag, limit ?? 10);

      return {
        ok: true,
        data: {
          tag,
          results: items,
        },
      };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'prompt_search_by_tag 실행 중 오류가 발생했습니다.',
      };
    }
  },
});
