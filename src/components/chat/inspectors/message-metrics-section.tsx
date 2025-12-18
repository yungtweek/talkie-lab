import { useMemo } from 'react';

import { LatencyTimelineCard } from '@/components/chat/inspectors/metrics-latency-card';
import { MetricsUsageCard } from '@/components/chat/inspectors/metrics-usage-card';
import { type ChatMetricsViewModel, toChatMetricsViewModel } from '@/lib/types/chat';

import type { RenderableMessage } from '@/components/chat';

interface Props {
  messages: RenderableMessage[];
  selectedMessageId: string | null;
}

function extractMetricsFromMessage(message: RenderableMessage): ChatMetricsViewModel | null {
  // ChatMessageProps 케이스
  if ('messageMetrics' in message && message.messageMetrics) {
    return Array.isArray(message.messageMetrics)
      ? (message.messageMetrics[0] ?? null)
      : message.messageMetrics;
  }

  // MessageWithHistory 케이스
  if ('MessageMetrics' in message && message.MessageMetrics && message.MessageMetrics.length > 0) {
    const base = message.MessageMetrics[0];
    return base
      ? toChatMetricsViewModel(base, {
          messageId: message.id,
          role: message.role,
          modelUsed: message.modelUsed ?? null,
          latencyMs: message.latencyMs ?? null,
        })
      : null;
  }

  return null;
}

export default function MessageMetricsSection({ messages, selectedMessageId }: Props) {
  const selected = useMemo(
    () => messages.find(m => m.id === selectedMessageId) ?? null,
    [messages, selectedMessageId],
  );

  if (!messages.length) return null;

  if (!selected) {
    return null;
    // return <div className="text-xs text-muted-foreground">No message selected.</div>;
  }

  // user/system 에는 메트릭 안 보여줄 거면
  if (selected.role !== 'assistant') {
    return null;
    // return <div className="text-xs text-muted-foreground">No LLM metrics for this message.</div>;
  }

  const metrics = extractMetricsFromMessage(selected);

  if (!metrics) {
    return null;
    // return <div className="text-xs text-muted-foreground">No metrics data.</div>;
  }

  return (
    <div className="space-y-1 text-xs">
      <LatencyTimelineCard
        latencyMs={metrics.latencyMs}
        providerLatencyMs={metrics.providerLatencyMs}
        overheadLatencyMs={metrics.overheadLatencyMs}
        startedAt={metrics.startedAt}
        firstTokenAt={metrics.firstTokenAt}
        completedAt={metrics.completedAt}
      />
      <MetricsUsageCard
        promptTokens={metrics.promptTokens}
        completionTokens={metrics.completionTokens}
      />
    </div>
  );
}
