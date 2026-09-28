import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVENT_KIND_META, hasActiveFilters } from "@/lib/equipe-utils";
import type { TimelineEvent, TimelineEventKind } from "@/data/types";
import { cn } from "@/lib/utils";

export interface TimelineFilterState {
  kind: TimelineEventKind | "all";
  responsible: string | "all";
  onlyApproved: boolean;
}

export const DEFAULT_FILTERS: TimelineFilterState = {
  kind: "all",
  responsible: "all",
  onlyApproved: false,
};

export function TimelineFilters({
  events,
  filters,
  onChange,
}: {
  events: TimelineEvent[];
  filters: TimelineFilterState;
  onChange: (next: TimelineFilterState) => void;
}) {
  const responsible = Array.from(new Set(events.map((e) => e.author))).sort();
  const kinds = Object.keys(EVENT_KIND_META) as TimelineEventKind[];
  const dirty = hasActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Filter className="size-3.5" />
        Filtrar
      </span>
      <label className="flex items-center gap-2 text-xs font-medium text-foreground">
        <span className="sr-only">Tipo de evento</span>
        <select
          aria-label="Tipo de evento"
          value={filters.kind}
          onChange={(e) => onChange({ ...filters, kind: e.target.value as TimelineEventKind | "all" })}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="all">Todos os tipos</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {EVENT_KIND_META[k].label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-foreground">
        <span className="sr-only">Responsável</span>
        <select
          aria-label="Responsável"
          value={filters.responsible}
          onChange={(e) => onChange({ ...filters, responsible: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="all">Todos os responsáveis</option>
          {responsible.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <div
        role="group"
        aria-label="Exibir eventos"
        className="flex items-center overflow-hidden rounded-md border border-input"
      >
        <button
          type="button"
          aria-pressed={!filters.onlyApproved}
          onClick={() => onChange({ ...filters, onlyApproved: false })}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-brand",
            !filters.onlyApproved ? "bg-brand text-brand-foreground" : "bg-background text-muted-foreground hover:bg-accent",
          )}
        >
          Todos
        </button>
        <button
          type="button"
          aria-pressed={filters.onlyApproved}
          onClick={() => onChange({ ...filters, onlyApproved: true })}
          className={cn(
            "border-l border-input px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-brand",
            filters.onlyApproved ? "bg-success text-success-foreground" : "bg-background text-muted-foreground hover:bg-accent",
          )}
        >
          Somente aprovados
        </button>
      </div>

      {dirty && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          className="ml-auto gap-1.5 rounded-md text-xs text-muted-foreground"
        >
          <RotateCcw className="size-3.5" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}