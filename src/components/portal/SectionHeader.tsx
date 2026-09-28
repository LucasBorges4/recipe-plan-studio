import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand shadow-sm">
            <Icon className="size-4.5" />
          </span>
        )}
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-foreground">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
