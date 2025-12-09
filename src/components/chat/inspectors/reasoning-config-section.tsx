import { useInferenceConfig } from '@/components/inference-config-provider';
import { Slider } from '@/components/ui/slider';
import { ReasoningEffortLevels } from '@/lib/ai/llm/model-registry';

export default function ReasoningConfigSection() {
  const { reasoningEffort, setReasoningEffort, model } = useInferenceConfig();

  const levels = model?.reasoningEfforts ?? ReasoningEffortLevels;
  if (!model?.reasoningEfforts) return null;
  const idx = levels.indexOf(reasoningEffort);

  return (
    <>
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Reasoning
        </h3>
        <div className="space-y-4 rounded-md border bg-background px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs">Effort</span>
            <span className="text-[10px] text-muted-foreground">{reasoningEffort}</span>
          </div>
          <Slider
            value={[idx]}
            min={0}
            max={levels.length - 1}
            step={1}
            onValueChange={([v]) => setReasoningEffort(levels[v])}
          />
        </div>
      </section>
    </>
  );
}
