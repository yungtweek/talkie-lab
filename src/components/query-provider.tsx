'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

import { getQueryClient } from '@/lib/query-client';

interface Props {
  children: ReactNode;
}

// ✅ Sexy, minimal Provider
export function QueryProvider({ children }: Props) {
  const client = getQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
