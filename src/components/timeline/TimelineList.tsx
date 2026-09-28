import { CalendarDays, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { groupByMonth, monthLabel } from "@/lib/equipe-utils";
import { TimelineEventRow } from "@/components/timeline/TimelineEventRow";
import type { TimelineEvent } from "@/data/types";

export function TimelineList({
  events,
  hasActiveFilters = false,
  onResetFilters,
}: {
  events: TimelineEvent[];
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
}) {
  const groups = groupByMonth(events);
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <CalendarDays className="size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">
          {hasActiveFilters
            ? "Nenhum evento corresponde aos filtros selecionados"
            : "Nenhum evento registrado ainda"}
        </p>
        <p className="text-xs text-muted-foreground">
          {hasActiveFilters
            ? "Ajuste ou limpe os filtros para ver todos os registros."
            : "Acompanhe aqui as entregas, decisões, aprovações, marcos e atualizações do projeto."}
        </p>
        {hasActiveFilters && onResetFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            className="mt-1 gap-1.5 rounded-md"
          >
            <RotateCcw className="size-3.5" />
            Limpar filtros
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.key} aria-label={`Eventos de ${monthLabel(g.key)}`}>
          <h3 className="mb-3 flex items-center gap-2 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wide text-foreground">
            <CalendarDays className="size-4 text-brand" />
            {monthLabel(g.key)}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {g.events.length}
            </span>
          </h3>
          <div className="space-y-3">
            {g.events.map((e) => (
              <TimelineEventRow key={e.id} event={e} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}