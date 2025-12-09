import { encodingForModel, getEncoding, getEncodingNameForModel } from 'js-tiktoken';
import { Globe, Loader2, Paperclip, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useInferenceConfig } from '@/components/inference-config-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import { getToolSchema } from '@/lib/ai/agents/tools-registry';
import { type AgentToolSchema } from '@/lib/ai/agents/types';

interface ChatInputProps {
  submitAction: (formData: FormData) => void;
  onSubmitHandler?: () => void;
  isBusy: boolean;
}
export function ChatInput({ submitAction, onSubmitHandler, isBusy }: ChatInputProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const isComposing = useRef(false);
  const [inputValue, setInputValue] = useState('');
  const [tools, setTools] = useState<AgentToolSchema[]>(() => {
    const promptSearchByTagTool = getToolSchema('prompt_search_by_tag');
    const promptCommitTool = getToolSchema('prompt_commit_tool');
    const defaultTools: AgentToolSchema[] = [];
    if (promptSearchByTagTool) defaultTools.push(promptSearchByTagTool);
    if (promptCommitTool) defaultTools.push(promptCommitTool);
    // defaultTools.push({ type: 'web_search' });
    return defaultTools;
  });
  const { chatMode, setChatMode, agent, setAgent, model } = useInferenceConfig();
  const modeLabel = chatMode === 'agent' ? 'Agent' : chatMode === 'manual' ? 'Manual' : 'Auto';
  const isSearchActive = tools.some(tool => tool.type === 'web_search');

  // TODO: Prepare default agent config even in auto mode
  useEffect(() => {
    if (tools.length === 0) return;
    console.log('Setting default agent config, tools: ', tools.map(tool => tool.type).join(','));
    setAgent({
      key: 'auto',
      name: 'Default Agent',
      description: 'Default Agent for chatMode:auto',
      role: 'assistant',
      tools,
      useHistorySummary: false,
    });
  }, [setAgent, tools]);

  return (
    <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-4 pb-8">
      <form
        ref={formRef}
        className={'grid w-full gap-6 overflow-hidden'}
        action={submitAction}
        onSubmit={() => {
          setTimeout(() => setInputValue(''), 0);
          if (onSubmitHandler) {
            onSubmitHandler();
          }
        }}
      >
        <input type="hidden" name="mode" value={chatMode} />
        <InputGroup>
          <InputGroupTextarea
            name={'input'}
            className="resize-none max-h-36"
            placeholder="Ask, Search or Chat..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !isBusy) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            onCompositionStart={() => {
              isComposing.current = true;
            }}
            onCompositionEnd={() => {
              isComposing.current = false;
            }}
          />
          <InputGroupAddon align="block-end" className="cursor-auto">
            {/* TODO: File Attachment */}
            <InputGroupButton variant="outline" className="rounded-full" size="icon-sm">
              <Paperclip />
            </InputGroupButton>
            <InputGroupButton
              type="button"
              variant={isSearchActive ? 'default' : 'outline'}
              className="rounded-full"
              size={isSearchActive ? 'sm' : 'icon-sm'}
              aria-pressed={isSearchActive}
              onClick={() =>
                setTools(prev => {
                  const exists = prev.some(tool => tool.type === 'web_search');
                  if (exists) {
                    return prev.filter(tool => tool.type !== 'web_search');
                  }
                  return [...prev, { type: 'web_search' }];
                })
              }
            >
              <Globe />
              {isSearchActive && <span className="ml-2">Search</span>}
            </InputGroupButton>
            {/*<DropdownMenu>*/}
            {/*  <DropdownMenuTrigger asChild>*/}
            {/*    <InputGroupButton variant="ghost" size="sm">*/}
            {/*      {modeLabel}*/}
            {/*    </InputGroupButton>*/}
            {/*  </DropdownMenuTrigger>*/}
            {/*  <DropdownMenuContent side="top" align="start" className="[--radius:0.95rem]">*/}
            {/*    <DropdownMenuItem*/}
            {/*      onSelect={() => {*/}
            {/*        setChatMode('auto');*/}
            {/*        const promptSearchByTagTool = getToolSchema('prompt_search_by_tag');*/}
            {/*        const promptCommitTool = getToolSchema('prompt_commit_tool');*/}
            {/*        setAgent({*/}
            {/*          key: 'default_pirate',*/}
            {/*          name: 'Default Agent',*/}
            {/*          description: 'Agent for prompt testing',*/}
            {/*          role: 'assistant',*/}
            {/*          tools:*/}
            {/*            promptSearchByTagTool && promptCommitTool*/}
            {/*              ? [promptSearchByTagTool, promptCommitTool]*/}
            {/*              : [],*/}
            {/*          useHistorySummary: false,*/}
            {/*        });*/}
            {/*      }}*/}
            {/*    >*/}
            {/*      Auto*/}
            {/*    </DropdownMenuItem>*/}
            {/*    <DropdownMenuItem*/}
            {/*      onSelect={() => {*/}
            {/*        setChatMode('agent');*/}
            {/*        const promptSearchByTagTool = getToolSchema('prompt_search_by_tag');*/}
            {/*        const promptCommitTool = getToolSchema('prompt_commit_tool');*/}
            {/*        setAgent({*/}
            {/*          key: 'default_pirate',*/}
            {/*          name: 'Default Agent',*/}
            {/*          description: 'Agent for prompt testing',*/}
            {/*          role: 'assistant',*/}
            {/*          tools:*/}
            {/*            promptSearchByTagTool && promptCommitTool*/}
            {/*              ? [promptSearchByTagTool, promptCommitTool]*/}
            {/*              : [],*/}
            {/*          useHistorySummary: false,*/}
            {/*        });*/}
            {/*      }}*/}
            {/*    >*/}
            {/*      Agent*/}
            {/*    </DropdownMenuItem>*/}
            {/*    <DropdownMenuItem*/}
            {/*      onSelect={() => {*/}
            {/*        setChatMode('manual');*/}
            {/*      }}*/}
            {/*    >*/}
            {/*      Manual*/}
            {/*    </DropdownMenuItem>*/}
            {/*  </DropdownMenuContent>*/}
            {/*</DropdownMenu>*/}
            {/*<InputGroupText className="ml-auto">52% used</InputGroupText>*/}
            {/*<Separator orientation="vertical" className="h-6" />*/}
            <InputGroupButton
              type="submit"
              variant="default"
              className="rounded-full ml-auto"
              size="icon-sm"
              disabled={isBusy}
            >
              {isBusy ? <Loader2 className="animate-spin" /> : <Send />}
              <span className="sr-only">Send</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}
