import { z } from 'zod';

import { type CreatePromptInput, createPromptSchema } from '@/schemas/prompt';

export const metadataIdSchema = z.uuid();
export const promptIdSchema = z.uuid();

export interface ParsedPromptForm {
  ok: true;
  data: CreatePromptInput;
}

export interface InvalidPromptForm {
  ok: false;
  fieldErrors: Record<string, string[]>;
}

export function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  return trimmed.split(/\s+/);
}

export function validatePromptForm(formData: FormData): ParsedPromptForm | InvalidPromptForm {
  const tags = parseTags(formData.get('tags'));
  const parsed = createPromptSchema.safeParse({
    name: formData.get('name'),
    key: formData.get('key'),
    content: formData.get('content'),
    description: formData.get('description') ?? undefined,
    alias: formData.get('alias') ?? undefined,
    note: formData.get('note') ?? undefined,
    responseExample: formData.get('responseExample') ?? undefined,
    tags,
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return { ok: false, fieldErrors };
  }

  return { ok: true, data: parsed.data };
}

export function parseUuid(schema: z.ZodSchema, raw: unknown): string | null {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data as string;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function resolvePromptVersionId(
  slug: string | undefined,
  versions: Array<{ id: string; version: number }>,
  latestPromptId?: string | null,
): string | undefined {
  if (slug) {
    if (isUuid(slug)) {
      const exists = versions.some(v => v.id === slug);
      if (exists) return slug;
    } else {
      const versionNum = Number(slug);
      if (!Number.isNaN(versionNum)) {
        const found = versions.find(v => v.version === versionNum);
        if (found) return found.id;
      }
    }
  }

  if (latestPromptId) return latestPromptId;
  return versions[0]?.id;
}
