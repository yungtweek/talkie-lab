'use client';

import { createContext, useContext, type PropsWithChildren, type ReactNode } from 'react';

import { useArtifact } from '@/hooks/use-artifact';

// Context value is exactly what useArtifact returns.
// This keeps the provider thin and lets us reuse all helpers from the hook.
type ArtifactContextValue = ReturnType<typeof useArtifact>;

const ArtifactContext = createContext<ArtifactContextValue | null>(null);

export interface ArtifactProviderProps {
  children: ReactNode;
}

/**
 * ArtifactProvider
 *
 * Provides a single shared UIArtifact state for all descendants.
 * Internally it uses the existing useArtifact hook so that helpers
 * (setArtifact, startStreaming, appendContent, finishStreaming, etc.)
 * stay in one place.
 */
export function ArtifactProvider({ children }: ArtifactProviderProps) {
  const artifactState = useArtifact();

  return <ArtifactContext.Provider value={artifactState}>{children}</ArtifactContext.Provider>;
}

/**
 * useArtifactContext
 *
 * Access the shared artifact state provided by ArtifactProvider.
 * This should be preferred over calling useArtifact() directly
 * when you want to share the same artifact instance across
 * multiple components (e.g. DataStreamHandler, ChatMessage).
 */
export function useArtifactContext(): ArtifactContextValue {
  const ctx = useContext(ArtifactContext);
  if (ctx === null) {
    throw new Error('useArtifactContext must be used within an ArtifactProvider');
  }
  return ctx;
}
