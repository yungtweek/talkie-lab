'use client';

import { TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartLegend, ChartTooltip } from '@/components/ui/chart';

export const description = 'A stacked bar chart with a legend';

const chartConfig = {
  overhead: {
    label: 'Overhead',
    color: 'var(--chart-1)',
  },
  provider: {
    label: 'Provider',
    color: 'var(--chart-2)',
  },
  streaming: {
    label: 'Streaming',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

interface LatencyTimelineCardProps {
  latencyMs?: number | null;
  providerLatencyMs?: number | null;
  overheadLatencyMs?: number | null;
  startedAt?: string | null;
  firstTokenAt?: string | null;
  completedAt?: string | null;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow">
      {payload.map((item: any) => (
        <div key={item.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: item.color ?? item.fill }}
            />
            <span className="text-muted-foreground">
              {(chartConfig as any)?.[item.dataKey]?.label ?? item.name}
            </span>
          </div>
          <span className="font-mono">{item.value} ms</span>
        </div>
      ))}
    </div>
  );
};

const CustomLegend = () => {
  return (
    <div className="relative flex w-full justify-center">
      <div className="inline-flex items-center gap-4 w-fit">
        {(Object.keys(chartConfig) as Array<keyof typeof chartConfig>).map(key => (
          <div key={key} className="flex items-center gap-1.5 text-xs w-fit">
            <span className="h-2 w-2 rounded-full" style={{ background: chartConfig[key].color }} />
            <span className="text-muted-foreground">{chartConfig[key].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function LatencyTimelineCard({
  latencyMs,
  providerLatencyMs,
  overheadLatencyMs,
  startedAt,
  firstTokenAt,
  completedAt,
}: LatencyTimelineCardProps) {
  const toMs = (iso?: string | null) => (iso ? new Date(iso).getTime() : null);

  const started = toMs(startedAt);
  const first = toMs(firstTokenAt);
  const completed = toMs(completedAt);

  // 총 소요시간: latencyMs 우선, 없으면 started~completed diff
  const totalMs = latencyMs ?? (started != null && completed != null ? completed - started : 0);

  // Overhead: 필드 있으면 그대로, 없으면 started~first diff
  const overhead = overheadLatencyMs != null ? Math.max(overheadLatencyMs, 0) : 0;

  // Provider(모델): started~first diff 우선, 없으면 providerLatencyMs 그대로 사용
  const provider =
    started != null && first != null
      ? Math.max(first - started, 0)
      : providerLatencyMs != null
        ? Math.max(providerLatencyMs, 0)
        : 0;

  // 나머지는 Streaming 구간으로
  const used = overhead + provider;
  const streaming = Math.max(totalMs - used, 0);

  const chartData = [
    {
      label: 'latency',
      overhead,
      provider,
      streaming,
    },
  ];

  const segments = [
    { key: 'overhead', value: overhead, fill: 'var(--color-overhead)' },
    { key: 'provider', value: provider, fill: 'var(--color-provider)' },
    { key: 'streaming', value: streaming, fill: 'var(--color-streaming)' },
  ];

  // 0 값은 제외
  const visibleSegments = segments.filter(s => s.value > 0);
  return (
    <Card className="gap-0 bg-transparent border-0 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle>Latency</CardTitle>
        {/*<CardDescription>January - June 2024</CardDescription>*/}
      </CardHeader>
      <CardContent className="px-4">
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData} barSize={5} layout="vertical">
            <XAxis type="number" tickFormatter={value => `${value} ms`} />
            <YAxis
              type="category"
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={false}
              width={0}
            />
            <CartesianGrid horizontal={true} />
            <ChartTooltip content={<CustomTooltip />} />
            <ChartLegend content={<CustomLegend />} />
            {visibleSegments.map((s, i) => {
              const isFirst = i === 0;
              const isLast = i === visibleSegments.length - 1;

              const radius: [number, number, number, number] = isFirst
                ? [999, 0, 0, 999]
                : isLast
                  ? [0, 999, 999, 0]
                  : [0, 0, 0, 0];

              return <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.fill} radius={radius} />;
            })}
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm px-4">
        {/*<div className="flex gap-2 leading-none font-medium">*/}
        {/*  Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />*/}
        {/*</div>*/}
        {/*<div className="text-muted-foreground leading-none">*/}
        {/*  Showing total visitors for the last 6 months*/}
        {/*</div>*/}
      </CardFooter>
    </Card>
  );
}
