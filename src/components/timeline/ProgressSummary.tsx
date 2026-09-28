import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/portal/StatusBadge";
import {
  EVENT_STATUS_META,
  lastMovement,
  summarizeEvolution,
  formatEventDateTime,
} from "@/lib/equipe-utils";
import type { TimelineEvent } from "@/data/types";

export function ProgressSummary({ events }: { events: TimelineEvent[] }) {
  const s = summarizeEvolution(events);
  const last = lastMovement(events);

  const stats = [
    { label: "Entregas aprovadas", value: s.entregasAprovadas },
    { label: "Itens em andamento", value: s.counts.em_andamento },
    { label: "Aguardando aprovação", value: s.counts.aguardando_aprovacao },
    { label: "Marcos concluídos", value: s.marcosConcluidos },
  ];

  return (
    <Card className="w-full border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="size-4 text-brand" />
          Resumo da evolução
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Percentual geral</span>
            <span className="font-semibold text-foreground">{s.progress}%</span>
          </div>
          <Progress
            value={s.progress}
            className="h-2 bg-neutral-soft"
            aria-label={`Percentual geral do projeto: ${s.progress}%`}
          />
        </div>

        <dl className="grid grid-cols-2 gap-2.5">
          {stats.map((st) => (
            <div
              key={st.label}
              className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
            >
              <dt className="text-[11px] text-muted-foreground">{st.label}</dt>
              <dd className="mt-0.5 text-2xl font-bold text-foreground">{st.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(EVENT_STATUS_META) as Array<keyof typeof EVENT_STATUS_META>).map((k) => (
            <StatusBadge key={k} tone={EVENT_STATUS_META[k].tone}>
              {EVENT_STATUS_META[k].label}: {s.counts[k]}
            </StatusBadge>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {last
            ? `Última atualização em ${formatEventDateTime(last.toISOString())}`
            : "Nenhum movimento registrado ainda."}
        </p>
      </CardContent>
    </Card>
  );
}