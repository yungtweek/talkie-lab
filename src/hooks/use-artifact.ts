import { type Dispatch, type SetStateAction, useMemo, useState } from 'react';

export type ToolRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ToolRun {
  /** Unique identifier for a single tool execution (e.g. function_call id). */
  id: string;
  /** Tool name (should match the function/tool name from the model). */
  name: string;
  status: ToolRunStatus;
  /** Milliseconds since epoch when the tool execution started. */
  startedAt: number;
  /** Optional completion timestamp (only set on success/failure). */
  finishedAt?: number;
  /** Raw arguments passed to the tool. */
  args?: unknown;
  /** Optional preview of the tool result for UI rendering. */
  resultPreview?: unknown;
}

export type ArtifactLog =
  | {
      type: 'tool_call';
      name: string;
      arguments: unknown;
      timestamp: number;
    }
  | {
      type: 'tool_result';
      name: string;
      output: unknown;
      success: boolean;
      timestamp: number;
    }
  | {
      type: 'reasoning';
      text: string;
      timestamp: number;
    }
  | {
      type: 'delta';
      delta: string;
      timestamp: number;
    }
  | {
      type: 'error';
      error: string;
      raw?: unknown;
      stack?: string;
      timestamp: number;
    }
  | {
      type: 'system';
      message: string;
      timestamp: number;
    };

// NOTE:
// Artifact represents any UI-rendered output, whether streaming or static.
// It is based on the Next.js UIArtifact structure, and `kind` is left open for domain-specific usage.

export type ArtifactKind = string & {};

export type ArtifactActionState =
  | 'none'
  | 'pending'
  | 'using-tool'
  | 'reasoning'
  | 'generating'
  | 'error';

export type UIArtifactStatus = 'streaming' | 'idle' | 'init' | 'done' | 'error';

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: UIArtifactStatus;
  actionState: ArtifactActionState;
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  toolRuns: ToolRun[];
  logs: ArtifactLog[];
}

export interface UseArtifactOptions {
  /** Initial state. Missing fields will be filled with sensible defaults. */
  initial?: Partial<UIArtifact>;
}

export interface UseArtifactResult {
  artifact: UIArtifact;
  isStreaming: boolean;
  /** Replaces the entire artifact object (advanced use only). */
  setArtifact: Dispatch<SetStateAction<UIArtifact>>;
}

function createDefaultArtifact(partial?: Partial<UIArtifact>): UIArtifact {
  return {
    title: partial?.title ?? '',
    documentId: partial?.documentId ?? '',
    kind: (partial?.kind ?? 'text') as ArtifactKind,
    content: partial?.content ?? '',
    isVisible: partial?.isVisible ?? true,
    status: partial?.status ?? 'idle',
    actionState: partial?.actionState ?? 'none',
    boundingBox: partial?.boundingBox ?? {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    },
    toolRuns: partial?.toolRuns ?? [],
    logs: partial?.logs ?? [],
  };
}

export type ArtifactSelector<T> = (artifact: UIArtifact) => T;

export function useArtifactSelector<T>(selector: ArtifactSelector<T>): T {
  const { artifact } = useArtifact();

  return useMemo(() => selector(artifact), [artifact, selector]);
}

/**
 * useArtifact
 *
 * - Manages a single local UI artifact (LLM result, file preview, external API output, etc.).
 * - Handles streaming state, metadata, content updates, and layout info.
 * - Actual SSE/WebSocket/LLM streaming is handled externally; this hook updates state via helpers.
 *
 * NOTE:
 * This hook creates its own isolated state. When you need to share one artifact
 * instance across multiple components (e.g., DataStreamHandler + ChatMessage),
 * wrap your tree with ArtifactProvider and use `useArtifactContext()` instead.
 */
export function useArtifact(options?: UseArtifactOptions): UseArtifactResult {
  const initial = createDefaultArtifact(options?.initial);

  const [artifact, setArtifact] = useState<UIArtifact>(initial);

  const isStreaming = artifact.status === 'streaming';

  return {
    artifact,
    isStreaming,
    setArtifact,
  };
}
