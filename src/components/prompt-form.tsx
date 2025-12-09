'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useState } from 'react';
import { Controller, type UseFormReturn, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  commitPromptAction,
  createPromptAction,
  getPromptByIdAction,
  type PromptActionState,
  updatePromptMetadataAction,
  updatePromptAction as updatePromptVersionAction,
  type ListPromptsByMetadataIdState,
} from '@/app/(prompts)/prompts/actions';
import { TagInput } from '@/components/tag-input';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { promptFormSchema } from '@/schemas/prompt';

import type { PromptFormValues } from '@/schemas/prompt';

type PromptsItem = Extract<ListPromptsByMetadataIdState, { status: 'success' }>['prompts'][number];

interface PromptFormProps {
  /**
   * 초기값 (수정 화면에서도 재사용 가능하도록)
   */
  defaultValues?: Partial<PromptFormValues>;
  /**
   * 저장 버튼 라벨 (Create / Save 등)
   */
  submitLabel?: string;
  /**
   * 성공 시 호출 (예: 리스트 리프레시 등)
   */
  onSuccess?: (state: PromptActionState) => void;
  /**
   * 취소 핸들러
   */
  onCancel?: () => void;
  /**
   * Optional metadata ID to pass through the form.
   */
  metadataId?: string;
  /**
   * Optional prompt (version) ID when editing an existing prompt version.
   */
  promptId?: string;
  prompts?: PromptsItem[];
}

interface MetadataSectionProps {
  form: UseFormReturn<PromptFormValues>;
  isEditMode: boolean;
  isMetaEdit: boolean;
  isUpdatePending: boolean;
  onToggleMeta: () => void;
  onSaveMeta: () => void;
}

interface PromptSectionProps {
  form: UseFormReturn<PromptFormValues>;
  metadataId?: string;
  versions?: PromptsItem[];
  selectedPromptId: string;
  onSelectPrompt: (id: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface SectionHeaderProps {
  title: string;
  description: string;
}

export function PromptForm({
  defaultValues,
  submitLabel = 'Create',
  onCancel,
  onSuccess,
  metadataId,
  prompts,
  promptId,
}: PromptFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(metadataId);

  const [createState, createAction, isCreatePending] = React.useActionState<
    PromptActionState,
    FormData
  >(createPromptAction, { status: 'idle' });

  const [updateState, updateMetadataAction, isUpdatePending] = React.useActionState<
    PromptActionState,
    FormData
  >(updatePromptMetadataAction, { status: 'idle' });

  const [createVersionState, createVersionAction, isCreateVersionPending] = React.useActionState<
    PromptActionState,
    FormData
  >(commitPromptAction, {
    status: 'idle',
  });

  const [updatePromptState, updatePromptAction, isUpdatePromptPending] = React.useActionState<
    PromptActionState,
    FormData
  >(updatePromptVersionAction, {
    status: 'idle',
  });

  const [isMetaEdit, setMetaEdit] = useState(false);
  const toggleMetaEdit = () => setMetaEdit(!isMetaEdit);

  const [open, setOpen] = React.useState(false);
  const [selectedPromptId, setSelectedPromptId] = React.useState(promptId ?? '');

  const effectivePromptId = selectedPromptId || promptId || '';

  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: {
      name: '',
      key: '',
      description: '',
      tags: [],
      content: '',
      alias: '',
      note: '',
      responseExample: '',
      ...defaultValues,
    },
  });

  React.useEffect(() => {
    if (!selectedPromptId) {
      return;
    }

    (async () => {
      try {
        const result = await getPromptByIdAction(selectedPromptId);
        if (result.status !== 'success' || !result.data) {
          return;
        }

        const data = result.data;

        form.reset({
          name: data.name ?? '',
          key: data.key ?? '',
          description: data.description ?? '',
          content: data.version.content ?? '',
          alias: data.version.alias ?? '',
          note: data.version.note ?? '',
          // 현재 스키마에 별도 저장 필드가 없다면 responseExample은 비워둡니다.
          responseExample: data.version.responseExample ?? '',
          tags: data.tags ?? [],
        });
      } catch (err) {
        console.error('[PromptForm] failed to load branch by id:', err);
      }
    })();
  }, [selectedPromptId, form]);

  const createSubmitHandler =
    (serverAction: (formData: FormData) => void) => (values: PromptFormValues) => {
      const fd = new FormData();

      fd.set('name', values.name ?? '');
      fd.set('key', values.key ?? '');
      fd.set('content', values.content ?? '');
      fd.set('description', values.description ?? '');
      fd.set('alias', values.alias ?? '');
      fd.set('note', values.note ?? '');
      fd.set('responseExample', values.responseExample ?? '');
      fd.set('tags', (values.tags ?? []).join(' '));

      if (metadataId) {
        fd.set('metadataId', metadataId);
      }
      const effective = selectedPromptId || promptId;
      if (effective) {
        fd.set('promptId', effective);
      }

      // React 19: useActionState dispatch는 transition 안에서 호출해야 isPending이 올바르게 동작함
      React.startTransition(() => {
        serverAction(fd);
      });
    };

  const defaultValidSubmit = createSubmitHandler(isEditMode ? updateMetadataAction : createAction);

  // (선택) 무효할 때 스크롤/포커스 등
  const handleInvalidSubmit = () => {
    // 예: 첫 에러 필드로 포커스 이동 등
  };

  const submitWith = (action: (formData: FormData) => void) =>
    form.handleSubmit(createSubmitHandler(action), handleInvalidSubmit)();

  React.useEffect(() => {
    const handleSuccess = (state: PromptActionState) => {
      if (onSuccess) {
        onSuccess(state);
      } else {
        // 기본 동작: 프롬프트 목록으로 이동
        router.push('/prompts');
      }
    };

    if (!isEditMode) {
      if (createState?.status === 'success') {
        handleSuccess(createState);
      }
    } else {
      if (updateState.status === 'success') {
        // Metadata-only update: do not navigate
        toast.success('Prompt metadata updated successfully.');
        return;
      }
      if (createVersionState.status === 'success') {
        handleSuccess(createVersionState as PromptActionState);
      } else if (updatePromptState.status === 'success') {
        handleSuccess(updatePromptState as PromptActionState);
      }
    }
  }, [
    isEditMode,
    createState,
    updateState,
    createVersionState,
    updatePromptState,
    onSuccess,
    router,
  ]);

  const errorMessage = !isEditMode
    ? createState?.status === 'error'
      ? createState.message
      : undefined
    : updateState.status === 'error'
      ? updateState.message
      : createVersionState.status === 'error'
        ? createVersionState.message
        : updatePromptState.status === 'error'
          ? updatePromptState.message
          : undefined;

  return (
    <>
      <Form {...form}>
        {errorMessage ? (
          <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
        <form
          onSubmit={form.handleSubmit(defaultValidSubmit, handleInvalidSubmit)}
          className="flex flex-col gap-6"
        >
          {metadataId && <input type="hidden" name="metadataId" value={metadataId} />}
          {effectivePromptId && <input type="hidden" name="promptId" value={effectivePromptId} />}
          <div className="space-y-6">
            <MetadataSection
              form={form}
              isEditMode={isEditMode}
              isMetaEdit={isMetaEdit}
              isUpdatePending={isUpdatePending}
              onToggleMeta={toggleMetaEdit}
              onSaveMeta={() => submitWith(updateMetadataAction)}
            />

            <PromptSection
              form={form}
              metadataId={metadataId}
              versions={prompts}
              selectedPromptId={selectedPromptId}
              onSelectPrompt={id => {
                setSelectedPromptId(id);
                if (!metadataId) return;
                const targetVersion = prompts?.find(v => v.id === id)?.version;
                const next = targetVersion
                  ? `/prompts/${metadataId}/${targetVersion}`
                  : `/prompts/${metadataId}`;
                router.replace(next);
              }}
              open={open}
              setOpen={setOpen}
            />
          </div>

          {/* 버튼 영역 */}
          <div className="sticky bottom-0 flex justify-end gap-2 bg-background py-4">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                if (onCancel) {
                  return onCancel();
                }
                router.push('/prompts');
              }}
            >
              Cancel
            </Button>

            {!isEditMode ? (
              <Button type="submit" disabled={isCreatePending} className="cursor-pointer">
                {isCreatePending ? 'Saving...' : submitLabel}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={isUpdatePromptPending}
                  className="cursor-pointer"
                  onClick={() => submitWith(updatePromptAction)}
                >
                  {isUpdatePromptPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isCreateVersionPending}
                  className="cursor-pointer"
                  onClick={() => submitWith(createVersionAction)}
                >
                  {isCreateVersionPending ? 'Saving...' : 'Save as new version'}
                </Button>
              </>
            )}
          </div>
        </form>
      </Form>
    </>
  );
}

function MetadataSection({
  form,
  isEditMode,
  isMetaEdit,
  isUpdatePending,
  onToggleMeta,
  onSaveMeta,
}: MetadataSectionProps) {
  const isMetaLocked = isEditMode && !isMetaEdit;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata</CardTitle>
        <CardDescription>
          Enter the basic information required to identify and manage this prompt.
        </CardDescription>
        <CardAction>
          {isEditMode && (
            <ButtonGroup>
              {isMetaEdit && (
                <Button
                  type="button"
                  variant={'outline'}
                  disabled={isUpdatePending}
                  className="cursor-pointer"
                  onClick={onSaveMeta}
                >
                  Save
                </Button>
              )}
              <Button
                type={'button'}
                variant={isMetaEdit ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={onToggleMeta}
              >
                Edit
              </Button>
            </ButtonGroup>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="prompt-name">Prompt Name *</FieldLabel>
                <FieldContent>
                  <Input
                    id="prompt-name"
                    {...field}
                    placeholder="get_country_names"
                    disabled={isMetaLocked}
                    aria-invalid={!!fieldState.error}
                  />
                  <FieldDescription>
                    Must start with a letter or underscore. Maximum length is 50 characters. Only
                    letters, numbers, spaces, hyphens (-), and underscores (_) are allowed.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="key"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="prompt-key">Key *</FieldLabel>
                <FieldContent>
                  <Input
                    id="prompt-key"
                    {...field}
                    placeholder="get_country_names"
                    disabled={isMetaLocked}
                    aria-invalid={!!fieldState.error}
                  />
                  <FieldDescription>
                    This key uniquely identifies the prompt. Letters and underscores are
                    recommended.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
        </div>

        <div className="mt-6 space-y-6">
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="prompt-description">Description</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="prompt-description"
                    {...field}
                    className="h-24 resize-y"
                    placeholder="Enter a description for this prompt. (Optional)"
                    disabled={isMetaLocked}
                    aria-invalid={!!fieldState.error}
                  />
                  <FieldDescription>
                    Providing a brief description will help distinguish this prompt in the list.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="tags"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="prompt-tags">Tags</FieldLabel>
                <FieldContent>
                  <div className="flex flex-col gap-2">
                    <TagInput
                      value={field.value ?? []}
                      onChange={value => field.onChange(value)}
                      placeholder="e.g. llm rag production"
                      disabled={isMetaLocked}
                    />
                    {/* Hidden input to serialize tags into formData */}
                    <input
                      id="prompt-tags"
                      type="hidden"
                      name="tags"
                      value={(field.value ?? []).join(' ')}
                    />
                  </div>
                  <FieldDescription>
                    Separate tags with spaces. (e.g. <code>system test</code>)
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PromptSection({
  form,
  metadataId,
  versions,
  selectedPromptId,
  onSelectPrompt,
  open,
  setOpen,
}: PromptSectionProps) {
  const versionLabel = React.useMemo(() => {
    if (!selectedPromptId || !versions?.length) {
      return 'Select version...';
    }
    const found = versions.find(v => v.id === selectedPromptId);
    if (!found) {
      return 'Select version...';
    }
    return found.alias ? `${found.version}: ${found.alias}` : `${found.version}`;
  }, [selectedPromptId, versions]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt</CardTitle>
        <CardDescription>
          Enter the prompt content and the expected response example to be sent to the model.
        </CardDescription>
        <CardAction>
          <div className='className="space-y-1 w-full flex justify-between items-center"'>
            {metadataId && versions && versions.length > 0 && (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-52 justify-between cursor-pointer')}
                  >
                    {versionLabel}
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-0">
                  <Command>
                    <CommandInput placeholder="Search version..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No version found.</CommandEmpty>
                      <CommandGroup>
                        {versions.map(version => (
                          <CommandItem
                            key={version.id}
                            value={
                              version.alias
                                ? `${version.version} ${version.alias}`
                                : `${version.version}`
                            }
                            onSelect={() => {
                              onSelectPrompt(version.id === selectedPromptId ? '' : version.id);
                              setOpen(false);
                            }}
                          >
                            {version.alias
                              ? `${version.version}: ${version.alias}`
                              : `${version.version}`}
                            <Check
                              className={cn(
                                'ml-auto',
                                selectedPromptId === version.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mt-6 space-y-6">
          <Controller
            control={form.control}
            name="content"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="prompt-content">Prompt *</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="prompt-content"
                    {...field}
                    className="h-48 resize-y"
                    placeholder="Give me {num} country names."
                    aria-invalid={!!fieldState.error}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Controller
              control={form.control}
              name="alias"
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel htmlFor="prompt-alias">Alias</FieldLabel>
                  <FieldContent>
                    <Input
                      id="prompt-alias"
                      {...field}
                      placeholder="Alias for this prompt version"
                      aria-invalid={!!fieldState.error}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </FieldContent>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="note"
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel htmlFor="prompt-note">Note</FieldLabel>
                  <FieldContent>
                    <Input
                      id="prompt-note"
                      {...field}
                      placeholder="Note for this prompt version"
                      aria-invalid={!!fieldState.error}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </FieldContent>
                </Field>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="responseExample"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="prompt-response-example">Response</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="prompt-response-example"
                    {...field}
                    className="h-24 resize-y"
                    placeholder="Optionally, provide a representative example of the expected response for this prompt."
                    aria-invalid={!!fieldState.error}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
