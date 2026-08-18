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

export function toneForStatus(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("conclu") || s.includes("conforme") && !s.includes("não")) return "success";
  if (s.includes("não conforme")) return "danger";
  if (s.includes("andamento") || s.includes("progresso")) return "info";
  if (s.includes("pendente") || s.includes("levantamento") || s.includes("aprova"))
    return "warning";
  return "neutral";
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
