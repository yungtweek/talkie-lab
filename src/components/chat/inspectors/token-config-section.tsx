// TokenConfigSection.tsx
'use client';

import { useInferenceConfig } from '@/components/inference-config-provider';
import { InlineNumberEditor } from '@/components/inline-number-editor';
import { Slider } from '@/components/ui/slider';

export default function TokenConfigSection() {
  const { model, maxOutputTokens, setMaxOutputTokens } = useInferenceConfig();
  if (!model?.maxTokens) return null;
  const effectiveValue = maxOutputTokens ?? model.maxTokens.default;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Tokens
      </h3>
      <div className="space-y-4 rounded-md border bg-background px-3 py-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs">MaxTokens</span>
          <InlineNumberEditor
            value={effectiveValue}
            min={model.maxTokens.min}
            max={model.maxTokens.max}
            step={2}
            onChange={setMaxOutputTokens}
          />
        </div>
        <Slider
          value={[effectiveValue]}
          min={model.maxTokens.min}
          max={model.maxTokens.max}
          step={2}
          onValueChange={([v]) => setMaxOutputTokens(v)}
        />
      </div>
    </section>
  );
}
