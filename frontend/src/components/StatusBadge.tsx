import { verdictTone } from '../lib/format';

interface StatusBadgeProps {
  value: string;
  compact?: boolean;
}

export function StatusBadge({ value, compact = false }: StatusBadgeProps) {
  const tone = verdictTone(value);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wider ${tone.bg} ${tone.text} ${tone.border} ${
        compact ? 'px-2 py-0.5 text-[10px] font-medium' : 'px-2.5 py-0.5 text-[11px] font-medium'
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      <span className="truncate">{value.replace(/_/g, ' ')}</span>
    </span>
  );
}
