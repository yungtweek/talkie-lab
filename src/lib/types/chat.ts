import { type MessageMetrics } from '@/generated/prisma/client';

/**
 * View-model for the metrics inspector.
 *
 * This is intentionally decoupled from the raw Prisma / API models so that
 * the inspector UI can evolve independently of the backend shape.
 */
export interface ChatMetricsViewModel {
  // Core identifiers
  messageId?: string;
  role?: string;
  model?: string | null;

  // Timings
  latencyMs?: number | null;
  providerLatencyMs?: number | null;
  overheadLatencyMs?: number | null;

  // Tokens
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;

  // Sampling / reasoning
  temperature?: number | null;
  topP?: number | null;
  reasoningEffort?: string | null;

  // Timeline
  startedAt?: string | null;
  firstTokenAt?: string | null;
  completedAt?: string | null;

  // Error
  errorMessage?: string | null;

  // Optional raw blob for debugging (e.g. full metrics record or response)
  raw?: unknown;
}

/**
 * Convert a schema-level MessageMetrics record into a UI-friendly view model.
 * Dates are normalized to ISO strings and nullable numeric fields are coerced
 * to null to simplify client consumption.
 */
export function toChatMetricsViewModel(
  metrics: MessageMetrics,
  context?: {
    messageId?: string;
    role?: string;
    modelUsed?: string | null;
    latencyMs?: number | null;
  },
): ChatMetricsViewModel {
  return {
    messageId: context?.messageId ?? metrics.messageId ?? undefined,
    role: context?.role,
    model: context?.modelUsed ?? metrics.modelUsed ?? null,
    latencyMs: context?.latencyMs ?? metrics.latencyMs ?? null,
    providerLatencyMs: metrics.providerLatencyMs ?? null,
    overheadLatencyMs: metrics.overheadLatencyMs ?? null,
    promptTokens: metrics.promptTokens ?? null,
    completionTokens: metrics.completionTokens ?? null,
    totalTokens: metrics.totalTokens ?? null,
    temperature: metrics.temperature ?? null,
    topP: metrics.topP ?? null,
    reasoningEffort: metrics.reasoningEffort ?? null,
    startedAt: metrics.startedAt ? metrics.startedAt.toISOString() : null,
    firstTokenAt: metrics.firstTokenAt ? metrics.firstTokenAt.toISOString() : null,
    completedAt: metrics.completedAt ? metrics.completedAt.toISOString() : null,
    errorMessage: metrics.errorMessage ?? null,
    raw: metrics,
  };
}
