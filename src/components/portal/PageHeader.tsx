import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  icon: Icon,
  title,
  titleClassName,
  subtitle,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  titleClassName?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon className="size-5" />
        </span>
        <div>
          <h1 className={cn("text-3xl font-semibold tracking-tight text-foreground", titleClassName)}>{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
