// ModelConfigSection.tsx
'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useModelsQuery } from '@/components/chat-inspector';
import { useInferenceConfig } from '@/components/inference-config-provider';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type LLMModelInfo } from '@/lib/ai/llm/model-registry';
import { cn } from '@/lib/utils';

export default function ModelConfigSection({ models }: { models: LLMModelInfo[] }) {
  const { model, setModel } = useInferenceConfig();

  const [open, setOpen] = useState(false);
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Model</h3>
      <div className="w-full relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {model?.label ?? models[0]?.label ?? 'Select model...'}
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
            <Command>
              <CommandInput placeholder="Search model..." className="h-9" />
              <CommandList>
                <CommandEmpty>No model found.</CommandEmpty>
                <CommandGroup>
                  {models.map(m => (
                    <CommandItem
                      key={m.name}
                      value={m.name}
                      onSelect={() => {
                        setModel(m);
                        setOpen(false);
                      }}
                    >
                      {m.label}
                      <Check
                        className={cn(
                          'ml-auto',
                          model?.name === m.name ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}
