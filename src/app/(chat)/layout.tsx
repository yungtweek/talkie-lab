import { dehydrate, HydrationBoundary, queryOptions } from '@tanstack/react-query';

import { getModels } from '@/app/(chat)/chat/actions';
import { getQueryClient } from '@/lib/query-client';

import type React from 'react';

export default async function chatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    queryOptions({
      queryKey: ['llm-models'],
      queryFn: () => getModels(),
    }),
  );
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
