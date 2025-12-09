import { useState } from 'react';

interface InlineNumberEditorProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}

export function InlineNumberEditor({
  value,
  min,
  max,
  step = 1,
  onChange,
}: InlineNumberEditorProps) {
  const format = (v: number) => {
    const stepStr = String(step);
    const frac = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
    return v.toFixed(frac);
  };

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(format(value));

  const commit = () => {
    const parsed = parseFloat(draft);

    if (Number.isNaN(parsed)) {
      // invalid input → just reset without changing value
      setDraft(format(value));
      setIsEditing(false);
      return;
    }

    const clamped = min != null && max != null ? Math.min(max, Math.max(min, parsed)) : parsed;

    const stepStr = String(step);
    const frac = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
    const rounded = Number(clamped.toFixed(frac));

    onChange(rounded);
    setDraft(format(rounded));
    setIsEditing(false);
  };

  return isEditing ? (
    <input
      type="number"
      className="w-20 h-6 rounded border bg-background px-2 py-0.5 text-[10px] text-right outline-none appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
      value={draft}
      min={min}
      max={max}
      step={step}
      autoFocus
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setIsEditing(false);
      }}
    />
  ) : (
    <span
      className="inline-flex w-20 h-6 items-center justify-end rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
      onClick={() => {
        setDraft(format(value)); // sync only when entering edit mode (React 19-safe)
        setIsEditing(true);
      }}
    >
      {format(value)}
    </span>
  );
}
