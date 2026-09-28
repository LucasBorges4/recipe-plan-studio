import { cn } from "@/lib/utils";
import type { StatusTone } from "@/data/types";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success-soft text-success border-success/20",
  info: "bg-info-soft text-info border-info/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  neutral: "bg-neutral-soft text-muted-foreground border-border",
  danger: "bg-danger-soft text-danger border-danger/20",
  brand: "bg-brand-soft text-brand border-brand/20",
};

export function StatusTag({
  children,
  tone = "neutral",
  size = "sm",
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[10px]",
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
