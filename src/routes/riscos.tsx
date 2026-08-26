import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import {
  RecordDialog,
  DeleteRecordButton,
  useCanManageRecords,
  type FieldDef,
} from "@/components/portal/RecordForm";
import { severityLabel, severityTone } from "@/data/risks";
import { readDocs } from "@/lib/doc-schemas";
import { usePortalData } from "@/lib/api-hooks";
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

const riskFields: FieldDef[] = [
  { name: "title", label: "Risco", type: "text", placeholder: "Ex.: Atraso na homologação fiscal" },
  { name: "category", label: "Categoria", type: "text", placeholder: "Ex.: Prazo, Segurança" },
  { name: "owner", label: "Dono do risco", type: "text" },
  { name: "probability", label: "Probabilidade (1 a 5)", type: "number", min: 1, max: 5 },
  { name: "impact", label: "Impacto (1 a 5)", type: "number", min: 1, max: 5 },
  { name: "mitigation", label: "Plano de mitigação", type: "textarea" },
];

function RiscosPage() {
  const { data: portal, isLoading } = usePortalData();
  const canManage = useCanManageRecords();
  const [cell, setCell] = useState<{ p: number; i: number } | null>(null);

  const risks = readDocs(portal?.docs, "risk");
  const list = cell
    ? risks.filter((r) => r.data.probability === cell.p && r.data.impact === cell.i)
    : risks;

  return (
    <>
      <PageHeader
        icon={AlertTriangle}
        title="Mapa de Riscos"
        subtitle="Probabilidade x impacto dos riscos do projeto"
      />
      <NoticeBanner />

      {canManage ? (
        <div className="mb-4 flex justify-end">
          <RecordDialog kind="risk" fields={riskFields} triggerLabel="Novo risco" />
        </div>
      ) : null}

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
                    const inCell = risks.filter(
                      (r) => r.data.probability === p && r.data.impact === i,
                    );
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
            const score = r.data.probability * r.data.impact;
            return (
              <article key={r.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{r.data.title}</h2>
                  <div className="flex items-center gap-1">
                    <StatusBadge tone={severityTone(score)}>
                      {severityLabel(score)} · {score}
                    </StatusBadge>
                    {canManage ? (
                      <>
                        <RecordDialog
                          kind="risk"
                          fields={riskFields}
                          id={r.id}
                          initial={r.data}
                          variant="icon"
                        />
                        <DeleteRecordButton id={r.id} label={r.data.title} />
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.data.category} · Dono: {r.data.owner} · P{r.data.probability} x I
                  {r.data.impact}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Mitigação: </span>
                  {r.data.mitigation}
                </p>
              </article>
            );
          })}
          {list.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {isLoading ? "Carregando riscos..." : "Nenhum risco nesta combinação."}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
