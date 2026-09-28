import { Clock, FileCheck } from "lucide-react";
import { SectionHeader } from "@/components/portal/SectionHeader";
import { PanelCard } from "@/components/portal/PanelCard";
import { formatAuditTime, formatAuditActor } from "@/lib/zaggo-helpers";
import type { AuditEntry } from "@/lib/records";

interface RecentActivityProps {
  lastAudits: AuditEntry[];
}

export function RecentActivity({ lastAudits }: RecentActivityProps) {
  return (
    <PanelCard>
      <SectionHeader
        title="Últimas Atualizações"
        subtitle="Trilha de auditoria — 5 registros mais recentes"
        icon={Clock}
      />
      {lastAudits.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          Nenhuma atualização registrada ainda.
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {lastAudits.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand shadow-sm">
                <FileCheck className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {formatAuditActor(a)} · {a.action}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatAuditTime(a.at)} · {a.entity}{" "}
                  {a.entityId ? `(#${a.entityId.slice(0, 8)})` : ""}
                </p>
                {a.after && (
                  <p className="mt-1 text-[11px] text-muted-foreground/70 truncate">
                    {a.after}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
