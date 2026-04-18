export function ResetButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="text-gray-400 hover:text-gray-600 text-xs leading-none cursor-pointer"
      onClick={onClick}
      title="Reset to default"
    >
      {'\u21A9'}
    </button>
  );
}

export function SliderOption({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  defaultValue?: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const isModified = defaultValue !== undefined && value !== defaultValue;
  return (
    <label className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs">
        <span className={`${isModified ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{label}</span>
        <span className="flex items-center gap-1">
          <ResetButton visible={isModified} onClick={() => onChange(defaultValue!)} />
          <span className="text-gray-400 tabular-nums">{value}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

export function SelectOption<T extends string>({
  label,
  value,
  defaultValue,
  options,
  onChange,
}: {
  label: string;
  value: T;
  defaultValue?: T;
  options: { value: T; label: string }[];
  onChange: (v: string) => void;
}) {
  const isModified = defaultValue !== undefined && value !== defaultValue;
  return (
    <label className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className={`text-xs ${isModified ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{label}</span>
        <ResetButton visible={isModified} onClick={() => onChange(defaultValue!)} />
      </div>
      <select
        className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
