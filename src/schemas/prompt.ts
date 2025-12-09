// src/schemas/prompt.ts
import { z } from 'zod';

/**
 * 프롬프트의 공통 베이스 스키마
 * - 메타데이터 + 실제 프롬프트 내용(content)
 * - 서버/DB 쪽에서 쓰기 좋은 형태
 */
export const basePromptSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter a prompt name.')
    .max(50, 'Maximum length is 50 characters.')
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9 _-]*$/,
      'Must start with a letter or underscore. Only letters, numbers, spaces, hyphens (-), and underscores (_) are allowed.',
    ),
  key: z
    .string()
    .min(1, 'Please enter a key.')
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_]*$/,
      'Must start with a letter or underscore. Only letters, numbers, and underscores are allowed.',
    ),
  description: z.string().optional(),
  tags: z.array(z.string()),
  content: z.string().min(1, 'Please enter the prompt content.'),
});

/**
 * UI 폼에서 사용할 스키마
 * - basePromptSchema에 UI 전용 필드들만 추가
 */
export const promptFormSchema = basePromptSchema.extend({
  alias: z.string().optional(),
  note: z.string().optional(),
  responseExample: z.string().optional(),
});

export type PromptFormValues = z.infer<typeof promptFormSchema>;

/**
 * 서버 액션에서 사용할 입력 스키마
 * - 값 정제/트리밍 등 transform 전용
 */
export const createPromptSchema = basePromptSchema
  .extend({
    alias: z.string().optional(),
    note: z.string().optional(),
    responseExample: z.string().optional(),
  })
  .transform(values => ({
    ...values,
    tags: (values.tags ?? []).map(t => t.trim()).filter(Boolean),
  }));

export type CreatePromptInput = z.infer<typeof createPromptSchema>;
