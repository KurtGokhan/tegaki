import type { CustomEffect } from '../url-state.ts';

export function EffectSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between text-[11px] text-gray-500">
      {label}
      <span className="flex items-center gap-1">
        <input
          type="range"
          className="w-24"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="tabular-nums w-7 text-right">
          {value}
          {suffix}
        </span>
      </span>
    </label>
  );
}

export function EffectColor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between text-[11px] text-gray-500">
      {label}
      <input
        type="color"
        {...{ alpha: 'true' }}
        className="w-6 h-5 rounded border border-gray-300 cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function GradientColorStops({ colors, onChange }: { colors: string[]; onChange: (colors: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {colors.map((c, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="color"
            {...{ alpha: 'true' }}
            className="w-6 h-5 rounded border border-gray-300 cursor-pointer"
            value={c}
            onChange={(e) => {
              const next = [...colors];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <span className="text-[11px] text-gray-400 flex-1">{c}</span>
          {colors.length > 2 && (
            <button
              type="button"
              className="text-gray-400 hover:text-red-500 text-xs cursor-pointer px-0.5"
              onClick={() => onChange(colors.filter((_, j) => j !== i))}
            >
              {'\u2212'}
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer self-start"
        onClick={() => onChange([...colors, '#888888'])}
      >
        + Add color
      </button>
    </div>
  );
}

export function CustomEffectControls({
  entry,
  onUpdate,
  onRemove,
  children,
}: {
  entry: CustomEffect;
  onUpdate: (key: string, update: Partial<CustomEffect>) => void;
  onRemove: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-gray-200 pl-3 ml-1">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 cursor-pointer">
          <input type="checkbox" checked={entry.enabled} onChange={(e) => onUpdate(entry.key, { enabled: e.target.checked })} />
          {entry.key}
        </label>
        <button
          type="button"
          className="text-gray-400 hover:text-red-500 text-xs cursor-pointer px-1"
          onClick={() => onRemove(entry.key)}
          title={`Remove ${entry.key}`}
        >
          {'\u2212'}
        </button>
      </div>
      {entry.enabled && <div className="flex flex-col gap-1.5 pl-5">{children}</div>}
    </div>
  );
}
