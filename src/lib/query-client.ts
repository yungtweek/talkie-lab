// ✅ Single source of truth for QueryClient options
import { isServer } from '@tanstack/query-core';
import { defaultShouldDehydrateQuery, type Query, QueryClient } from '@tanstack/react-query';

export const queryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
    dehydrate: {
      // include pending queries in dehydration
      shouldDehydrateQuery: (query: Query<unknown, Error, unknown, readonly unknown[]>) =>
        defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
    },
  },
};
let browserQueryClient: QueryClient | null = null;

export function getQueryClient() {
  if (isServer) {
    return new QueryClient(queryClientOptions);
  }

  if (!browserQueryClient) {
    browserQueryClient = new QueryClient(queryClientOptions);
  }

  return browserQueryClient;
}
