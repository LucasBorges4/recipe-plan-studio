import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-neutral-soft", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full bg-brand transition-all", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full bg-sidebar text-[10px] font-semibold text-sidebar-primary-foreground",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
