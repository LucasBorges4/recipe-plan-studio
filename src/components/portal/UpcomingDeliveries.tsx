import { Calendar } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SectionHeader } from "@/components/portal/SectionHeader";
import { StatusTag } from "@/components/portal/StatusTag";
import { PanelCard } from "@/components/portal/PanelCard";
import { formatBR } from "@/lib/doc-schemas";

interface UpcomingItem {
  id?: string;
  title?: string;
  name?: string;
  kind: "milestone" | "step";
  due: string;
  status?: string;
  type?: string;
}

interface UpcomingDeliveriesProps {
  upcomingSteps: UpcomingItem[];
}

export function UpcomingDeliveries({ upcomingSteps }: UpcomingDeliveriesProps) {
  return (
    <PanelCard>
      <SectionHeader
        title="Próximas Entregas"
        subtitle="Milestones e próximos passos com datas futuras"
        icon={Calendar}
        actions={
          <Link to="/tarefas" className="text-xs font-semibold text-brand hover:underline">
            Ver todas
          </Link>
        }
      />
      {upcomingSteps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          Nenhuma entrega futura cadastrada.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {upcomingSteps.map((s) => (
            <li
              key={`${s.id ?? s.title ?? s.due}-${s.kind}`}
              className="py-3 first:pt-0 last:pb-0"
            >
              <Link
                to="/tarefas"
                className="group block rounded-lg px-2 py-1 -mx-2 hover:bg-surface transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                      {s.title ?? s.kind}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatBR(s.due)}
                    </p>
                  </div>
                  <StatusTag
                    tone={(() => {
                      const st = (s.status ?? s.type ?? "").toLowerCase();
                      if (st.includes("concl")) return "success";
                      if (st.includes("andam") || st.includes("progresso")) return "info";
                      if (st.includes("pend") || st.includes("aprova")) return "warning";
                      return "neutral";
                    })()}
                    size="xs"
                  >
                    {s.status ?? s.type ?? s.kind}
                  </StatusTag>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
