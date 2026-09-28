import { AlertTriangle, CheckSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SectionHeader } from "@/components/portal/SectionHeader";
import { StatusTag } from "@/components/portal/StatusTag";
import { PanelCard } from "@/components/portal/PanelCard";
import type { Risk } from "@/data/types";

interface PointsOfAttentionProps {
  risks: Risk[];
  approvalPendingTasks: number;
}

export function PointsOfAttention({ risks, approvalPendingTasks }: PointsOfAttentionProps) {
  return (
    <PanelCard>
      <SectionHeader
        title="Pontos de atenção"
        subtitle="Riscos abertos + aprovações pendentes combinados"
        icon={AlertTriangle}
      />
      <div className="space-y-3">
        {risks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
            Nenhum risco cadastrado.
          </div>
        ) : (
          risks.slice(0, 3).map((r) => (
            <Link
              to="/riscos"
              key={r.id}
              className="block rounded-lg border border-border bg-surface/40 p-3 transition-colors hover:bg-surface hover:border-brand/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-foreground truncate">{r.title}</h4>
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                    {r.category} · Responsável: {r.owner}
                  </p>
                </div>
                <StatusTag
                  tone={
                    r.probability >= 4 || r.impact >= 4
                      ? "danger"
                      : r.probability >= 3
                        ? "warning"
                        : "neutral"
                  }
                  size="xs"
                >
                  P{r.probability} · I{r.impact}
                </StatusTag>
              </div>
              <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-2">
                {r.mitigation}
              </p>
            </Link>
          ))
        )}
        {approvalPendingTasks > 0 && (
          <Link
            to="/tarefas"
            className="block rounded-lg border border-warning/20 bg-warning-soft/30 p-3 transition-colors hover:bg-warning-soft/50"
          >
            <div className="flex items-start gap-2.5">
              <CheckSquare className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <h4 className="text-sm font-bold text-foreground">Aprovações pendentes</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {approvalPendingTasks} tarefa(s) aguardando sua aprovação na coluna "Em
                  Aprovação".
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </PanelCard>
  );
}
