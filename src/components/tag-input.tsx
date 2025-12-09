'use client';

import { useQuery } from '@tanstack/react-query';
import { Command, CommandGroup, CommandItem } from 'cmdk';
import { X } from 'lucide-react';
import * as React from 'react';
import { useMemo } from 'react';

import { listAllTagsAction } from '@/app/(prompts)/prompts/actions';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeTag, cleanTagInput, filterTagSuggestions } from '@/lib/tags';

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TagInput({ value, onChange, placeholder, disabled }: TagInputProps) {
  const [input, setInput] = React.useState('');
  const [isComposing, setIsComposing] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState<number | null>(null);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [forceClose, setForceClose] = React.useState(false);

  // 1) 전체 태그 목록 로딩
  const { data: allTags = [] } = useQuery({
    queryKey: ['prompt-tags', 'all'],
    queryFn: () => listAllTagsAction(),
    staleTime: 5 * 60 * 1000,
  });

  // 2) 입력값 + 전체 태그 → suggestion 리스트 계산
  const suggestions = useMemo(() => filterTagSuggestions(allTags, input), [allTags, input]);

  React.useEffect(() => {
    // 입력이 바뀌면 자동완성 팝오버를 다시 열 수 있도록 초기화
    setForceClose(false);
  }, [input]);

  React.useEffect(() => {
    setHighlightedIndex(null);
  }, [input, suggestions.length]);

  const isOpen = !disabled && !forceClose && suggestions.length > 0 && input.length > 0;

  const addTag = (raw: string) => {
    if (disabled) return;
    const trimmed = raw.trim();
    if (!trimmed) return;

    // 필요하면 normalizeTag(trimmed) 써도 됨
    const tag = normalizeTag(trimmed);

    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
  };

  const removeTag = (tag: string) => {
    if (disabled) return;
    onChange(value.filter(t => t !== tag));
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = e => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    if (isComposing) {
      return;
    }

    // ⌘Space / ⌃Space / 기타 modifier 조합은 태그 확정으로 쓰지 않는다
    if (e.key === ' ' && (e.metaKey || e.ctrlKey)) {
      return;
    }

    // suggestion 목록이 있을 때 방향키/Tab으로 하이라이트 이동
    const isArrowNav = e.key === 'ArrowDown' || e.key === 'ArrowUp';
    const isTabNav = e.key === 'Tab';

    if ((isArrowNav || isTabNav) && suggestions.length > 0) {
      e.preventDefault();

      const moveDown = isArrowNav ? e.key === 'ArrowDown' : !e.shiftKey; // Tab: 기본은 아래, Shift+Tab은 위로
      const moveUp = !moveDown;

      setHighlightedIndex(prev => {
        if (prev === null) {
          return moveDown ? 0 : suggestions.length - 1;
        }
        const delta = moveDown ? 1 : -1;
        let next = prev + delta;
        if (next < 0) next = suggestions.length - 1;
        if (next >= suggestions.length) next = 0;
        return next;
      });
      return;
    }

    // Esc로 팝오버 닫고 input에 포커스 이동
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setHighlightedIndex(null);
        setForceClose(true);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
      return;
    }

    const isConfirmKey =
      (e.key === ' ' || e.key === 'Enter' || e.key === ',') &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey;

    if (isConfirmKey) {
      console.log('[handleKeyDown] isConfirmKey: ', e.key);
      e.preventDefault();

      let chosen: string | null = null;

      // 1) 추천 태그가 정확히 1개일 때는 자동 선택
      if (suggestions.length === 1) {
        chosen = suggestions[0];
      }
      // 2) 하이라이트된 태그가 있으면 그걸 선택
      else if (highlightedIndex !== null && suggestions[highlightedIndex]) {
        chosen = suggestions[highlightedIndex];
      }
      // 3) 그 외에는 현재 입력값을 태그로 확정 (`,` 포함)
      else if (input.trim()) {
        chosen = input;
      }

      if (chosen) {
        addTag(chosen);
      }

      setInput('');
      setHighlightedIndex(null);
      return;
    }

    if (e.key === 'Backspace' && input === '' && value.length > 0) {
      console.log('[handleKeyDown] Backspace: ', e.key);
      e.preventDefault();
      const last = value[value.length - 1];
      removeTag(last);
    }
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = () => {
    if (disabled) return;
    // 포커스 빠질 때 남은 입력 있으면 태그로 확정
    if (input.trim()) {
      addTag(input);
      setInput('');
    }
  };

  return (
    <Popover open={isOpen}>
      <PopoverTrigger asChild>
        <div className="flex flex-wrap gap-2 rounded-md border bg-transparent px-2 py-1 w-full">
          {value.map(tag => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              <span className="cursor-default">{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}

          <input
            ref={inputRef}
            className="flex-1 min-w-[80px] bg-transparent px-1 py-1 text-sm outline-none"
            value={input}
            onCompositionStart={() => {
              console.log('onCompositionStart');
              setIsComposing(true);
            }}
            onCompositionEnd={e => {
              console.log('onCompositionEnd', e);
              setIsComposing(false);
              setInput(cleanTagInput(e.currentTarget.value));
            }}
            onChange={e => {
              const raw = e.target.value;
              if (isComposing) {
                setInput(raw);
                return;
              }
              const cleaned = cleanTagInput(raw);
              setInput(cleaned);
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={value.length === 0 ? placeholder : undefined}
            disabled={disabled}
          />
        </div>
      </PopoverTrigger>

      {/** Suggestion dropdown */}
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[200px] px-2 py-1"
        onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
      >
        <Command>
          <CommandGroup
            // heading="Suggested Tags"
            className="space-y-1 text-sm text-muted-foreground"
          >
            {suggestions.map((tag, idx) => (
              <CommandItem
                key={tag}
                value={tag}
                onSelect={() => {
                  addTag(tag);
                  setInput('');
                  setHighlightedIndex(null);
                }}
                className={`cursor-pointer ${
                  highlightedIndex === idx ? 'bg-accent text-accent-foreground' : ''
                }`}
              >
                #{tag}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
