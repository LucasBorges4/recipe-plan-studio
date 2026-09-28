import { cn } from "@/lib/utils";

export function DonutChart({
  value,
  max = 100,
  size = 160,
  strokeWidth = 14,
  segments,
  label,
  sublabel,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  segments?: { label: string; color: string; value: number }[];
  label?: React.ReactNode;
  sublabel?: string;
  className?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const offset = c - (c * pct) / 100;

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90 size-full">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-neutral-soft"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="stroke-brand transition-all duration-700"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label ?? (
          <span className="text-3xl font-extrabold tracking-tight text-foreground">
            {Math.round(pct)}%
          </span>
        )}
        {sublabel ? (
          <span className="mt-1 text-[10px] text-muted-foreground">{sublabel}</span>
        ) : null}
      </div>
    </div>
  );
}
