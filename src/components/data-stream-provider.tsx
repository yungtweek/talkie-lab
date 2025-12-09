'use client';

import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type ChatStreamRequest = Record<string, unknown> | null;

// Lightweight data-stream context used by streaming handlers.
// This provider only manages the raw stream deltas; higher-level hooks
// (e.g. useArtifact and DataStreamHandler) are responsible for turning
// these deltas into UI state.

export interface DataStreamContextValue {
  request: ChatStreamRequest;
  setRequest: React.Dispatch<React.SetStateAction<ChatStreamRequest>>;
}

const DataStreamContext = createContext<DataStreamContextValue | undefined>(undefined);

export interface DataStreamProviderProps {
  children: ReactNode;
}

export function DataStreamProvider({ children }: DataStreamProviderProps) {
  const [request, setRequest] = useState<ChatStreamRequest>(null);

  const value: DataStreamContextValue = {
    request,
    setRequest,
  };

  return <DataStreamContext.Provider value={value}>{children}</DataStreamContext.Provider>;
}

export function useDataStream(): DataStreamContextValue {
  const ctx = useContext(DataStreamContext);
  if (!ctx) {
    throw new Error('useDataStream must be used within a DataStreamProvider');
  }
  return ctx;
}
