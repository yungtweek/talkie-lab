'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/app/(auth)/auth';
import {
  success,
  error,
  notFound,
  type SuccessResult,
  type ErrorResult,
  type NotFoundResult,
  type ActionResult,
} from '@/lib/action-result';
import { type ActionState } from '@/lib/action-state';
import {
  archivePromptMetadata,
  commitPrompt,
  createPromptWithMetadata,
  getPromptById,
  getPromptMetadata,
  listAllPromptTags,
  listPromptsByMetadataId,
  unarchivePromptMetadata,
  updatePrompt,
  updatePromptMetadata,
  searchPromptMetadata,
  type PromptListItem,
} from '@/lib/repositories/prompt-repository';
import { type CreatePromptInput } from '@/schemas/prompt';

import { metadataIdSchema, parseUuid, promptIdSchema, validatePromptForm } from './prompt-action-helpers';

import type { PromptMetadata } from './columns';
import type { ZodSchema } from 'zod';

export type PromptActionState = ActionState<
  { metadataId?: string; promptId?: string },
  { fieldErrors?: Record<string, string[]> }
>;

export interface ListPromptMetadataState {
  listMetadata: PromptMetadata[];
  tags: string[];
  nextCursor: string | null;
}

export type GetPromptMetadataState =
  | SuccessResult<{
      data: {
        metadata: Awaited<ReturnType<typeof getPromptMetadata>>;
        prompts: PromptListItem[];
      };
    }>
  | NotFoundResult
  | ErrorResult;

export type ListPromptsByMetadataIdState = SuccessResult<{ prompts: PromptListItem[] }> | ErrorResult;

export type GetPromptByIdState =
  | SuccessResult<{ data: Awaited<ReturnType<typeof getPromptById>> }>
  | NotFoundResult
  | ErrorResult;

const INVALID_INPUT_MESSAGE = '입력값을 확인해주세요.';
const INVALID_ID_MESSAGE = '잘못된 요청입니다.';
const GENERIC_SAVE_ERROR = '프롬프트 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

interface PromptFormWithIdParams {
  formData: FormData;
  idField: string;
  idSchema: ZodSchema;
  onExecute: (data: CreatePromptInput, id: string) => Promise<PromptActionState>;
  onErrorLogLabel: string;
  onErrorMessage?: string;
  invalidIdMessage?: string;
}

async function handlePromptFormWithId(params: PromptFormWithIdParams): Promise<PromptActionState> {
  const {
    formData,
    idField,
    idSchema,
    onExecute,
    onErrorLogLabel,
    onErrorMessage = GENERIC_SAVE_ERROR,
    invalidIdMessage = INVALID_ID_MESSAGE,
  } = params;

  const validated = validatePromptForm(formData);
  if (validated.ok === false) {
    return error(INVALID_INPUT_MESSAGE, { fieldErrors: validated.fieldErrors });
  }

  const id = parseUuid(idSchema, formData.get(idField));
  if (!id) {
    return error(invalidIdMessage);
  }

  try {
    return await onExecute(validated.data, id);
  } catch (err) {
    console.error(onErrorLogLabel, err);
    return error(onErrorMessage);
  }
}

export async function createPromptAction(
  _prevState: PromptActionState,
  formData: FormData,
): Promise<PromptActionState> {
  const validated = validatePromptForm(formData);
  if (validated.ok === false) {
    return error(INVALID_INPUT_MESSAGE, { fieldErrors: validated.fieldErrors });
  }
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const data = validated.data;

  try {
    const prompt = await createPromptWithMetadata({
      name: data.name,
      key: data.key,
      description: data.description ?? null,
      content: data.content,
      tags: data.tags ?? [],
      userId,
    });

    return success({ promptId: String(prompt.id) });
  } catch (err) {
    console.error('[createPromptAction] failed:', err);

    return error('프롬프트 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}

export async function updatePromptMetadataAction(
  _prevState: PromptActionState,
  formData: FormData,
): Promise<PromptActionState> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return handlePromptFormWithId({
    formData,
    idField: 'metadataId',
    idSchema: metadataIdSchema,
    onErrorLogLabel: '[updatePromptAction] failed:',
    onExecute: async (data, metadataId) => {
      const result = await updatePromptMetadata({
        metadataId,
        name: data.name,
        description: data.description ?? null,
        tags: data.tags ?? [],
        userId,
      });

      return success({ metadataId: String(result.metadata.id) });
    },
  });
}

export async function updatePromptAction(
  _prevState: PromptActionState,
  formData: FormData,
): Promise<PromptActionState> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return handlePromptFormWithId({
    formData,
    idField: 'promptId',
    idSchema: promptIdSchema,
    onErrorLogLabel: '[updatePromptAction] failed:',
    onExecute: async (data, promptId) => {
      const result = await updatePrompt({
        promptId,
        content: data.content,
        alias: data.alias,
        note: data.note,
        response_example: data.responseExample,
        userId,
      });

      return success({ promptId: String(result.prompt.id) });
    },
  });
}

export async function commitPromptAction(
  _prevState: PromptActionState,
  formData: FormData,
): Promise<PromptActionState> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return handlePromptFormWithId({
    formData,
    idField: 'metadataId',
    idSchema: metadataIdSchema,
    onErrorLogLabel: '[createPromptVersionAction] failed:',
    onExecute: async (data, metadataId) => {
      const result = await commitPrompt({
        metadataId,
        content: data.content,
        alias: data.alias,
        note: data.note,
        response_example: data.responseExample,
        userId,
      });

      return success({ promptId: String(result.prompt.id) });
    },
  });
}

export interface ListPromptMetadataInput {
  cursor?: string;
  query?: string;
  take?: number;
}

export async function listPromptMetadata(input?: ListPromptMetadataInput): Promise<ListPromptMetadataState> {
  const { cursor, query, take = 20 } = input ?? {};

  const { items, nextCursor } = await searchPromptMetadata({
    cursor,
    query,
    take,
  });

  const prompts: PromptMetadata[] = items.map(item => ({
    id: item.metadata.id,
    name: item.metadata.name,
    tags: item.metadata.tags,
    updatedAt: item.metadata.updatedAt.toISOString(),
  }));

  const tags = await listAllPromptTags();

  return { listMetadata: prompts, tags, nextCursor };
}

export async function listAllTagsAction() {
  return await listAllPromptTags();
}

export async function getPromptMetadataAction(metadataId: string): Promise<GetPromptMetadataState> {
  const id = parseUuid(metadataIdSchema, metadataId);
  if (!id) return error('잘못된 요청입니다.');

  const metadata = await getPromptMetadata(id);
  if (!metadata) return notFound();

  const prompts = await listPromptsByMetadataId(id);
  if (!prompts || prompts.length === 0) return notFound();

  return success({ data: { metadata, prompts: prompts } });
}

export async function getPromptsByMetadataIdAction(metadataId: string): Promise<ListPromptsByMetadataIdState> {
  const id = parseUuid(metadataIdSchema, metadataId);
  if (!id) return error('잘못된 요청입니다.');

  const prompts = await listPromptsByMetadataId(id);
  if (!prompts || prompts.length === 0) return notFound();

  return success({ prompts });
}

export async function getPromptByIdAction(promptId: string): Promise<GetPromptByIdState> {
  const id = parseUuid(promptIdSchema, promptId);
  if (!id) return error('잘못된 요청입니다.');

  try {
    const data = await getPromptById(id);
    if (!data) return notFound();
    return success({ data });
  } catch (err) {
    console.error('[getPromptBranchById] failed:', err);
    return error('프롬프트 정보를 가져오는 중 오류가 발생했습니다.');
  }
}

export async function archivePromptMetadataAction(id: string): Promise<PromptActionState> {
  const metadataId = parseUuid(metadataIdSchema, id);
  if (!metadataId) {
    return error('잘못된 요청입니다.');
  }
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  try {
    await archivePromptMetadata(metadataId, userId);
    revalidatePath('/prompts');
    return success();
  } catch (err) {
    console.error('[archivePromptBranchAction] failed:', err);

    return error('프롬프트 삭제(보관) 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}

export async function unarchivePromptMetadataAction(id: string): Promise<PromptActionState> {
  const metadataId = parseUuid(metadataIdSchema, id);
  if (!metadataId) {
    return error('Invalid prompt id');
  }
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  try {
    await unarchivePromptMetadata(metadataId, userId);
    revalidatePath('/prompts');
    return success();
  } catch (err) {
    console.error('[unarchivePromptBranchAction] failed:', err);
    return error('Failed to restore prompt');
  }
}
