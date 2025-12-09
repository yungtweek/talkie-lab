import { useInferenceConfig } from '@/components/inference-config-provider';
import { InlineNumberEditor } from '@/components/inline-number-editor';
import { Slider } from '@/components/ui/slider';

export default function SamplingConfigSection() {
  const { model, topP, temperature, setTopP, setTemperature } = useInferenceConfig();

  const tempConfig = model?.temperature;
  const topPConfig = model?.topP;
  const hasTemp = !!tempConfig;
  const hasTopP = !!topPConfig;

  if (!hasTemp && !hasTopP) return null;

  return (
    <>
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Sampling
        </h3>
        {hasTemp && (
          <div className="space-y-4 rounded-md border bg-background px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs">Temperature</span>
              <InlineNumberEditor
                value={temperature}
                min={tempConfig!.min}
                max={tempConfig!.max}
                step={tempConfig!.step ?? 0.05}
                onChange={setTemperature}
              />
            </div>
            <Slider
              value={[temperature]}
              min={tempConfig!.min}
              max={tempConfig!.max}
              step={tempConfig!.step ?? 0.05}
              onValueChange={([v]) => setTemperature(v)}
            />
          </div>
        )}

        {hasTopP && (
          <div className="space-y-4 rounded-md border bg-background px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs">Top-P</span>
              <InlineNumberEditor
                value={topP}
                min={topPConfig!.min}
                max={topPConfig!.max}
                step={topPConfig!.step ?? 0.1}
                onChange={setTopP}
              />
            </div>
            <Slider
              value={[topP]}
              min={topPConfig!.min}
              max={topPConfig!.max}
              step={topPConfig!.step ?? 0.1}
              onValueChange={([v]) => setTopP(v)}
            />
          </div>
        )}
      </section>
    </>
  );
}
