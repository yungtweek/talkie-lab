'use client';

import { useMutation } from '@tanstack/react-query';
import { Plus, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createContext,
  type Dispatch,
  type SetStateAction,
  startTransition,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { toast } from 'sonner';

import {
  archivePromptMetadataAction,
  unarchivePromptMetadataAction,
  listPromptMetadata,
  type ListPromptMetadataInput,
  type ListPromptMetadataState,
  type PromptActionState,
} from '@/app/(prompts)/prompts/actions';
import { columns, pickerColumns } from '@/app/(prompts)/prompts/columns';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PromptsVariant = 'page' | 'picker';

interface PromptsProps {
  data?: ListPromptMetadataState;
  variant?: PromptsVariant;
  onSelectMetadata?: (item: PromptListItem) => void;
}

interface ArchiveContextValue {
  setItems: Dispatch<SetStateAction<ListPromptMetadataState['listMetadata']>>;
}

type PromptListItem = ListPromptMetadataState['listMetadata'][number];

const ArchiveContext = createContext<ArchiveContextValue | null>(null);

export function Prompts({ data, variant = 'page', onSelectMetadata }: PromptsProps) {
  const router = useRouter();
  const [items, setItems] = useState<PromptListItem[]>(data?.listMetadata ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(data?.nextCursor ?? null);
  const [query, setQuery] = useState('');
  const isPicker = variant === 'picker';

  const [loadResult, loadMore, isLoadingMore] = useActionState(
    async (_prev: ListPromptMetadataState | null, input: ListPromptMetadataInput | null) => {
      if (!input?.cursor) {
        return null;
      }
      return await listPromptMetadata(input);
    },
    null as ListPromptMetadataState | null,
  );

  useEffect(() => {
    if (!loadResult) {
      return;
    }
    startTransition(() => {
      setItems(prev => [...prev, ...(loadResult.listMetadata ?? [])]);
      setNextCursor(loadResult.nextCursor ?? null);
    });
  }, [loadResult]);

  const handleSearch = useCallback(
    async (initial = false) => {
      const trimmed = query.trim();
      const res = await listPromptMetadata({
        query: initial ? undefined : trimmed.length > 0 ? trimmed : undefined,
      });
      startTransition(() => {
        setItems(res.listMetadata ?? []);
        setNextCursor(res.nextCursor ?? null);
      });
    },
    [query],
  );

  useEffect(() => {
    if (!data) {
      void handleSearch(true);
      return;
    }
    startTransition(() => {
      setItems(data.listMetadata ?? []);
      setNextCursor(data.nextCursor ?? null);
    });
  }, [data, handleSearch]);

  return (
    <ArchiveContext.Provider value={{ setItems }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {!isPicker && (
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-semibold">Prompts</h1>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <div className={'flex justify-between'}>
            <ButtonGroup className={'w-full max-w-[300px]'}>
              <Input
                placeholder="Search..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    void handleSearch();
                  }
                }}
              />
              <Button variant="outline" aria-label="Search" onClick={() => void handleSearch()}>
                <SearchIcon />
              </Button>
            </ButtonGroup>

            {!isPicker && (
              <Button variant="default" asChild>
                <Link href="/prompts/new" className="flex items-center gap-1">
                  <Plus />
                  Create
                </Link>
              </Button>
            )}
          </div>
        </div>

        <DataTable
          columns={isPicker ? pickerColumns : columns}
          data={items}
          rowProps={row => ({
            className: 'cursor-pointer',
            onClick: () => {
              const item = row.original as PromptListItem;

              if (onSelectMetadata) {
                onSelectMetadata(item);
                return;
              }

              const id = (row.original as { id: string }).id;
              router.push(`/prompts/${id}`);
            },
          })}
        />

        {nextCursor && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() =>
                startTransition(() =>
                  loadMore({
                    cursor: nextCursor,
                    query: query?.trim() ? query.trim() : undefined,
                  }),
                )
              }
              disabled={isLoadingMore}
              className={cn(isLoadingMore && 'cursor-wait')}
            >
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    </ArchiveContext.Provider>
  );
}

export function useArchivePromptMutation() {
  const router = useRouter();
  const ctx = useContext(ArchiveContext);
  if (!ctx) {
    throw new Error('useArchivePromptMutation must be used within Prompts');
  }
  const { setItems } = ctx;

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res: PromptActionState = await archivePromptMetadataAction(id);
      if (res.status === 'error') {
        const message = res.message ?? 'Archive failed';
        throw new Error(message);
      }
      return { id, name };
    },
    onSuccess: async ({ id, name }) => {
      let removedEntry: { item: PromptListItem; index: number } | null = null;
      setItems(prev => {
        const idx = prev.findIndex(item => item.id === id);
        if (idx !== -1) {
          removedEntry = { item: prev[idx], index: idx };
        }
        return prev.filter(item => item.id !== id);
      });
      toast.success('Archive successful', {
        description: `${name}\n(${id})`,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const res: PromptActionState = await unarchivePromptMetadataAction(id);
              if (res.status === 'error') {
                const message = res.message ?? 'Failed to restore';
                return Promise.reject(new Error(message));
              }
              if (removedEntry) {
                setItems(prev => {
                  const next = [...prev];
                  const insertAt = Math.min(removedEntry!.index, next.length);
                  next.splice(insertAt, 0, removedEntry!.item);
                  return next;
                });
              }
              router.refresh();
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to restore';
              toast.error(msg);
            }
          },
        },
      });
      router.refresh();
    },
    onError: err => {
      const msg = err instanceof Error ? err.message : 'Archive failed';
      toast.error(msg);
    },
  });
}
