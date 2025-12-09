import { TrendingUp } from 'lucide-react';
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';

const chartConfig = {
  prompt: {
    label: 'Prompt tokens',
    color: 'var(--chart-1)',
  },
  completion: {
    label: 'Completion tokens',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

interface MetricsUsageCardProps {
  promptTokens?: number | null;
  completionTokens?: number | null;
}

export function MetricsUsageCard({ promptTokens, completionTokens }: MetricsUsageCardProps) {
  const safePrompt = typeof promptTokens === 'number' ? promptTokens : 0;
  const safeCompletion = typeof completionTokens === 'number' ? completionTokens : 0;
  const totalTokens = safePrompt + safeCompletion;

  const chartData = [
    {
      name: 'Tokens',
      prompt: safePrompt,
      completion: safeCompletion,
    },
  ];

  return (
    <Card className="relative gap-0 flex flex-col bg-transparent border-0 py-4">
      <CardHeader className="items-center px-4">
        <CardTitle>Token usage</CardTitle>
        {/*<CardDescription>Prompt vs Response tokens</CardDescription>*/}
      </CardHeader>
      <CardContent className="flex flex-1 items-center px-4 pb-0">
        <ChartContainer config={chartConfig} className="mx-auto h-[220px] w-full max-w-[255px]">
          <RadialBarChart
            data={chartData}
            startAngle={180}
            endAngle={0}
            innerRadius={80}
            outerRadius={130}
          >
            {/*<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel={false} />} />*/}
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 16}
                          className="fill-foreground text-2xl font-bold"
                        >
                          {totalTokens.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 4}
                          className="fill-muted-foreground"
                        >
                          Tokens
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
            <RadialBar
              dataKey="prompt"
              stackId="a"
              cornerRadius={5}
              fill={chartConfig.prompt.color}
              className="stroke-transparent stroke-1"
            />
            <RadialBar
              dataKey="completion"
              stackId="a"
              cornerRadius={5}
              fill={chartConfig.completion.color}
              className="stroke-transparent stroke-1"
            />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="absolute bottom-6 left-0 right-0 flex flex-col gap-3 text-xs">
        <div className="flex items-center gap-2 leading-none font-medium">
          Total tokens for this reply
          <TrendingUp className="h-4 w-4" />
          {/*<span className="text-base">{totalTokens.toLocaleString()}</span>*/}
        </div>
        <div className="flex flex-col gap-1 text-muted-foreground">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: chartConfig.prompt.color }}
              />
              <span>Prompt tokens</span>
            </div>
            <span>{safePrompt.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: chartConfig.completion.color }}
              />
              <span>Completion tokens</span>
            </div>
            <span>{safeCompletion.toLocaleString()}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
