import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export type StatTone = "brand" | "success" | "info" | "warning" | "danger" | "neutral";

export function StatCard({
  label,
  value,
  tone = "brand",
  trend,
  trendValue,
  className,
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
  trend?: "up" | "down" | "neutral";
  trendValue?: string | undefined;
  className?: string;
}) {
  const toneClasses: Record<StatTone, string> = {
    brand: "text-brand",
    success: "text-success",
    info: "text-info",
    warning: "text-warning",
    danger: "text-danger",
    neutral: "text-muted-foreground",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand/30",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-3">
        <p className={cn("text-3xl font-extrabold tracking-tight", toneClasses[tone])}>{value}</p>
        {trendValue && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              toneClasses[tone],
            )}
          >
            {trend === "up" && <ArrowUpRight className="size-3" />}
            {trend === "down" && <ArrowDownRight className="size-3" />}
            {trendValue}
          </span>
        )}
      </div>
      {trend && !trendValue && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {trend === "up"
            ? "↑ vs. período anterior"
            : trend === "down"
              ? "↓ vs. período anterior"
              : "— sem variação"}
        </p>
      )}
    </div>
  );
}
