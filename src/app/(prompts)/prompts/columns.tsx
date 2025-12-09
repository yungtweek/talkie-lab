'use client';
import { type ColumnDef } from '@tanstack/react-table';

import { useArchivePromptMutation } from '@/components/prompts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface PromptMetadata {
  id: string;
  name: string;
  tags: string[];
  updatedAt: string;
}

const COLUMN_WIDTHS = {
  id: 300,
  name: 200,
  tags: 200,
  updatedAt: 200,
  actions: 120,
} as const;

function ActionsCell({ id, name }: { id: string; name: string }) {
  const { mutate } = useArchivePromptMutation();

  return (
    <div className="flex items-center gap-2">
      {/*<button*/}
      {/*  type="button"*/}
      {/*  className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs"*/}
      {/*  onClick={e => {*/}
      {/*    e.stopPropagation();*/}
      {/*  }}*/}
      {/*>*/}
      {/*  ▶*/}
      {/*</button>*/}

      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs"
        onClick={e => {
          e.stopPropagation();
          mutate({ id, name });
        }}
      >
        🗑
      </button>
    </div>
  );
}

const baseColumns: Array<ColumnDef<PromptMetadata>> = [
  {
    accessorKey: 'id',
    header: 'Prompt ID',
    maxSize: COLUMN_WIDTHS.id,
    cell: ({ row }) => {
      const text = String(row.getValue('id') ?? '');
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block truncate">{text}</span>
          </TooltipTrigger>
          <TooltipContent side="top">{text}</TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: 'name',
    header: 'Prompt Name',
    maxSize: COLUMN_WIDTHS.name,
    cell: ({ row }) => {
      const text = String(row.getValue('name') ?? '');
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block truncate">{text}</span>
          </TooltipTrigger>
          <TooltipContent side="top">{text}</TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    maxSize: COLUMN_WIDTHS.tags,
    cell: ({ row }) => {
      const tags = row.original.tags ?? [];
      return (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <span
              key={tag}
              className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    maxSize: COLUMN_WIDTHS.updatedAt,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.getValue('updatedAt')}</span>
    ),
  },
];

const actionsColumn: ColumnDef<PromptMetadata> = {
  id: 'actions',
  header: 'Setting',
  maxSize: COLUMN_WIDTHS.actions,
  cell: ({ row }) => <ActionsCell id={row.original.id} name={row.original.name} />,
};

export const columns: Array<ColumnDef<PromptMetadata>> = [...baseColumns, actionsColumn];

export const pickerColumns: Array<ColumnDef<PromptMetadata>> = [...baseColumns];
