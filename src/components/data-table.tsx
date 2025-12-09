// src/components/data-table.tsx
'use client';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
} from '@tanstack/react-table';
import { SquareTerminal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

import type * as React from 'react';

interface DataTableProps<TData, TValue> {
  columns: Array<ColumnDef<TData, TValue>>;
  data: TData[];
  rowProps?: (row: Row<TData>) => React.HTMLAttributes<HTMLTableRowElement>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  rowProps,
}: DataTableProps<TData, TValue>) {
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <table className="w-full table-fixed text-sm">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(header => (
                <th
                  key={header.id}
                  className="border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground truncate"
                  style={{
                    width: header.getSize() ? `${header.getSize()}px` : undefined,
                    // minWidth: header.getSize() ? `${header.getSize()}px` : undefined,
                    maxWidth: header.getSize() ? `${header.getSize()}px` : undefined,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10">
                <div className="flex justify-center">
                  <Empty>
                    <EmptyContent>No results</EmptyContent>
                  </Empty>
                </div>
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map(row => {
              const extraRowProps = rowProps ? rowProps(row) : {};
              const { className: extraClassName, ...restRowProps } = extraRowProps;
              const mergedClassName = ['hover:bg-muted/40', extraClassName]
                .filter(Boolean)
                .join(' ');

              return (
                <tr key={row.id} className={mergedClassName} {...restRowProps}>
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 align-middle truncate"
                      style={{
                        width: cell.column.getSize() ? `${cell.column.getSize()}px` : undefined,
                        maxWidth: cell.column.getSize() ? `${cell.column.getSize()}px` : undefined,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
