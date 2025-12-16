import { Check, ChevronsUpDown, FileTerminal, RotateCcw } from 'lucide-react';
import { startTransition, useActionState, useEffect, useState, useRef } from 'react';

import {
  getPromptMetadataAction,
  type GetPromptMetadataState,
  getPromptByIdAction,
  type GetPromptByIdState,
  type ListPromptsByMetadataIdState,
} from '@/app/(prompts)/prompts/actions';
import { useInferenceConfig } from '@/components/inference-config-provider';
import { Prompts } from '@/components/prompts';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { PromptListItem } from '@/lib/repositories/prompt-repository';

interface SystemPromptSectionProps {
  initialPrompts?: PromptListItem[];
}
export default function SystemPromptSection({ initialPrompts }: SystemPromptSectionProps) {
  const { systemPrompt, setSystemPrompt, promptId, setPromptMetadataId, setPromptId } =
    useInferenceConfig();
  const [openPromptPicker, setOpenPromptPicker] = useState(false);
  const [openPrompt, setOpenPrompt] = useState(false);
  const [localVersions, setLocalVersions] = useState<ListPromptsByMetadataIdState>(() => ({
    status: 'success',
    prompts: initialPrompts ?? [],
  }));

  // const didInitVersionsRef = useRef(false);
  //
  // useEffect(() => {
  //   if (!initialPrompts || initialPrompts.length === 0) return;
  //
  //   if (didInitVersionsRef.current) return; // 이미 한 번 초기화했으면 패스
  //   didInitVersionsRef.current = true;
  //
  //   startTransition(() => {
  //     setLocalVersions({
  //       status: 'success',
  //       prompts: initialPrompts,
  //     });
  //   });
  // }, [initialPrompts]);

  // const didInitPromptIdRef = useRef(false);
  //
  // useEffect(() => {
  //   if (!initialPromptId) return;
  //   if (didInitPromptIdRef.current) return; // 두 번 이상 안 돌게
  //   didInitPromptIdRef.current = true;
  //
  //   setPromptId(initialPromptId);
  // }, [initialPromptId, setPromptId]);

  const [_, getPromptMetadata] = useActionState<GetPromptMetadataState, string>(
    async (_prevState, metadataId) => {
      const result = await getPromptMetadataAction(metadataId);
      if (result.status === 'success') {
        const latest = result.data?.metadata?.latestVersion;
        const content = latest?.content ?? '';
        const prompts = result.data?.prompts ?? [];
        setSystemPrompt(content);
        setLocalVersions({ status: 'success', prompts: prompts });

        // ✅ Provider에 메타데이터 + 최신 프롬프트 반영
        setPromptMetadataId(metadataId);
        if (latest?.id) {
          setPromptId(latest.id);
        } else {
          setPromptId(null);
        }
      }
      return result;
    },
    {
      status: 'not_found',
      message: 'Prompt metadata not found.',
    },
  );

  const [_prompt, fetchPrompt] = useActionState<GetPromptByIdState, string>(
    async (_prevState, promptId) => {
      const result = await getPromptByIdAction(promptId);
      if (result.status === 'success') {
        const data = result.data;
        const content = data?.version?.content ?? '';
        setSystemPrompt(content);

        // ✅ Provider에 선택된 프롬프트 ID 반영
        if (data?.version?.id) {
          setPromptId(data.version.id);
        }
      }
      return result;
    },
    {
      status: 'not_found',
      message: 'Prompt not found.',
    },
  );

  const selectedVersion =
    promptId && localVersions.status === 'success'
      ? localVersions.prompts.find(v => v.id === promptId)
      : null;

  const selectedVersionLabel = selectedVersion
    ? selectedVersion.alias
      ? `${selectedVersion.version}: ${selectedVersion.alias}`
      : `${selectedVersion.version}`
    : 'Select Version...';

  const isResetActive =
    promptId ||
    systemPrompt.trim().length > 0 ||
    (localVersions.status === 'success' && localVersions.prompts.length > 0);

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        System Prompt
      </h3>
      {localVersions.status === 'success' && localVersions.prompts.length > 1 && (
        <div className="w-full relative">
          <Popover open={openPrompt} onOpenChange={setOpenPrompt}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openPrompt}
                className="w-full justify-between"
              >
                {selectedVersionLabel}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
              <Command>
                <CommandInput placeholder="Search prompt..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No prompt found.</CommandEmpty>
                  <CommandGroup>
                    {localVersions.prompts.map(v => (
                      <CommandItem
                        key={v.id}
                        value={v.id}
                        onSelect={() => {
                          if (v.id) {
                            setPromptId(v.id);
                            startTransition(() => {
                              fetchPrompt(v.id);
                            });
                          }
                          setOpenPrompt(false);
                        }}
                      >
                        {v.alias ? `${v.version}: ${v.alias}` : `${v.version}`}
                        <Check
                          className={cn('ml-auto', promptId === v.id ? 'opacity-100' : 'opacity-0')}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="grid w-full gap-3">
        <Textarea
          className="h-20"
          rows={5}
          placeholder="Type system prompt here."
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
        />
        <ButtonGroup className="w-full flex items-center justify-end">
          <Dialog open={openPromptPicker} onOpenChange={setOpenPromptPicker}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon-sm">
                    <FileTerminal />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>

              <TooltipContent>
                <p>Load Prompt</p>
              </TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-4xl" onCloseAutoFocus={e => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>Prompts</DialogTitle>
                <DialogDescription>
                  Anyone who has this link will be able to view this.
                </DialogDescription>
              </DialogHeader>
              <div className="overscroll-contain max-h-[420px] overflow-auto">
                <Prompts
                  variant="picker"
                  onSelectMetadata={data => {
                    startTransition(() => {
                      getPromptMetadata(data.id);
                    });
                    setOpenPromptPicker(false);
                  }}
                />
              </div>
              <DialogFooter className="sm:justify-start">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Close
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={!isResetActive}
                onClick={() => {
                  if (!isResetActive) return;
                  setSystemPrompt('');
                  setLocalVersions({ status: 'success', prompts: [] });

                  // ✅ Provider state도 초기화
                  setPromptMetadataId(null);
                  setPromptId(null);
                }}
              >
                <RotateCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reset Prompt</p>
            </TooltipContent>
          </Tooltip>
        </ButtonGroup>
      </div>
    </section>
  );
}
