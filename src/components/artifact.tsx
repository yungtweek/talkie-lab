// Artifact definitions and streaming delta types.
// This module intentionally stays minimal so we can gradually add
// text/code/image/sheet artifacts as the UI evolves.

import type { ArtifactKind, UIArtifact } from '@/hooks/use-artifact';

export type StreamDeltaType =
  | 'data-id'
  | 'data-title'
  | 'data-kind'
  | 'data-clear'
  | 'data-finish'
  // Allow future custom delta types:
  | (string & {});

export interface StreamDelta {
  type: StreamDeltaType;
  data: string;
}

// Per-kind artifact behavior for streaming updates.
// If no definition exists for a given kind, the handler will fall back
// to its built-in default logic.
export interface ArtifactDefinition {
  kind: ArtifactKind;
  onStreamPart?: (args: {
    streamPart: StreamDelta;
    setArtifact: (next: UIArtifact) => void;
  }) => void;
}

// TODO: add concrete artifact definitions (text, code, image, sheet, ...)
// as the UI starts to use them. For now we rely on the default handler behavior.
export const artifactDefinitions: ArtifactDefinition[] = [];
