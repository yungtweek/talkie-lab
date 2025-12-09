import { z } from 'zod';

import { registerTool } from '@/lib/ai/agents/tools-registry';

/* TODO: Calculator tool */
// TODO: Minimal four-function calculator with parentheses support

const calculatorSchema = z.object({
  expression: z.string().min(1, 'expression is required'),
});

registerTool({
  type: 'function',
  name: 'calculator',
  description: '간단한 수식(expression)을 계산해서 결과를 반환하는 툴',
  schema: calculatorSchema,
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '계산할 수식 (예: "1 + 2 * 3")',
      },
    },
    required: ['expression'],
    additionalProperties: false,
  },
  async execute(rawArgs, _ctx) {
    const parsed = calculatorSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message };
    }
    const { expression } = parsed.data;

    // TODO: Avoid eval-style usage; allow only numbers/operators/parentheses
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      return { ok: false, error: '지원하지 않는 표현식입니다.' };
    }

    try {
      const fn = new Function(`return (${expression});`);
      const result = fn();
      if (typeof result !== 'number' || Number.isNaN(result)) {
        return {
          ok: false,
          error: '계산 결과가 숫자가 아닙니다.',
        };
      }
      return { ok: true, data: { expression, result } };
    } catch (e) {
      return {
        ok: false,
        error: '표현식을 계산하는 중 오류가 발생했습니다.',
      };
    }
  },
});
