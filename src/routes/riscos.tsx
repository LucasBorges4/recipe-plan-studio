import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { risks, severityLabel, severityTone } from "@/data/risks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/riscos")({
  head: () => ({
    meta: [
      { title: "Mapa de Riscos — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Matriz de probabilidade e impacto dos riscos do projeto ERP, com donos e planos de mitigação.",
      },
      { property: "og:title", content: "Mapa de Riscos — Grupo Geos" },
      {
        property: "og:description",
        content: "Riscos técnicos, legais e de prazo com severidade calculada.",
      },
    ],
  }),
  component: RiscosPage,
});

const cellTone = (score: number) =>
  score >= 15
    ? "bg-danger-soft"
    : score >= 9
      ? "bg-warning-soft"
      : score >= 4
        ? "bg-info-soft"
        : "bg-success-soft";

function RiscosPage() {
  const [cell, setCell] = useState<{ p: number; i: number } | null>(null);
  const list = cell ? risks.filter((r) => r.probability === cell.p && r.impact === cell.i) : risks;

  return (
    <>
      <PageHeader
        icon={AlertTriangle}
        title="Mapa de Riscos"
        subtitle="Probabilidade x impacto dos riscos do projeto"
      />
      <NoticeBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Matriz 5x5</h2>
          <div className="mt-4 flex gap-2">
            <div className="flex flex-col justify-between py-1 text-[10px] text-muted-foreground">
              {[5, 4, 3, 2, 1].map((p) => (
                <span key={p} className="flex h-14 items-center">
                  P{p}
                </span>
              ))}
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-5 gap-1">
                {[5, 4, 3, 2, 1].map((p) =>
                  [1, 2, 3, 4, 5].map((i) => {
                    const score = p * i;
                    const inCell = risks.filter((r) => r.probability === p && r.impact === i);
                    const selected = cell?.p === p && cell?.i === i;
                    return (
                      <button
                        key={`${p}-${i}`}
                        onClick={() => setCell(selected ? null : { p, i })}
                        className={cn(
                          "flex h-14 items-center justify-center rounded-md text-xs font-semibold text-foreground/70 transition-all",
                          cellTone(score),
                          selected && "ring-2 ring-brand",
                        )}
                        aria-label={`Probabilidade ${p}, impacto ${i}`}
                      >
                        {inCell.length > 0 ? inCell.length : ""}
                      </button>
                    );
                  }),
                )}
              </div>
              <div className="mt-1 grid grid-cols-5 gap-1 text-center text-[10px] text-muted-foreground">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i}>I{i}</span>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Clique em uma célula para filtrar a lista. Severidade = probabilidade x impacto.
          </p>
          {cell ? (
            <button
              onClick={() => setCell(null)}
              className="mt-2 text-xs text-brand underline-offset-2 hover:underline"
            >
              Limpar filtro
            </button>
          ) : null}
        </section>

        <section className="space-y-3">
          {list.map((r) => {
            const score = r.probability * r.impact;
            return (
              <article key={r.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{r.title}</h2>
                  <StatusBadge tone={severityTone(score)}>
                    {severityLabel(score)} · {score}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.category} · Dono: {r.owner} · P{r.probability} x I{r.impact}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Mitigação: </span>
                  {r.mitigation}
                </p>
              </article>
            );
          })}
          {list.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhum risco nesta combinação de probabilidade e impacto.
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
