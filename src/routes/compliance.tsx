import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShieldCheck, Paperclip, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { ProgressBar } from "@/components/portal/ProgressBar";
import { controls } from "@/data/compliance";
import { toast } from "sonner";

export const Route = createFileRoute("/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Controles de conformidade LGPD, ISO 27001 e SOX com responsáveis, status e datas de revisão.",
      },
      { property: "og:title", content: "Compliance — Grupo Geos" },
      {
        property: "og:description",
        content: "Acompanhamento das obrigações regulatórias do Grupo Geos.",
      },
    ],
  }),
  component: CompliancePage,
});

const norms = ["Todas", "LGPD", "ISO 27001", "SOX"] as const;
const statuses = ["Todos", "Conforme", "Em Andamento", "Pendente", "Não Conforme"] as const;

function CompliancePage() {
  const [norm, setNorm] = useState<(typeof norms)[number]>("Todas");
  const [status, setStatus] = useState<(typeof statuses)[number]>("Todos");

  const list = useMemo(
    () =>
      controls.filter(
        (c) => (norm === "Todas" || c.norm === norm) && (status === "Todos" || c.status === status),
      ),
    [norm, status],
  );

  const conform = controls.filter((c) => c.status === "Conforme").length;
  const overdue = controls.filter((c) => c.overdue).length;

  return (
    <>
      <PageHeader
        icon={ShieldCheck}
        title="Compliance"
        subtitle="Controles de conformidade e obrigações regulatórias"
      />
      <NoticeBanner />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Aderência geral</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {Math.round((conform / controls.length) * 100)}%
          </p>
          <ProgressBar value={(conform / controls.length) * 100} className="mt-3" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Controles monitorados</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{controls.length}</p>
          <p className="mt-3 text-xs text-muted-foreground">LGPD, ISO 27001 e SOX</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Revisões vencidas</p>
          <p className="mt-1 text-2xl font-semibold text-danger">{overdue}</p>
          <p className="mt-3 text-xs text-muted-foreground">Exigem ação imediata</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={norm}
          onChange={(e) => setNorm(e.target.value as (typeof norms)[number])}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
          aria-label="Filtrar por norma"
        >
          {norms.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof statuses)[number])}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
          aria-label="Filtrar por status"
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <ul className="space-y-3">
        {list.map((c) => (
          <li
            key={c.id}
            className={`rounded-xl border bg-card p-5 ${c.overdue ? "border-danger/40" : "border-border"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{c.control}</h2>
                  <StatusBadge tone="neutral">{c.norm}</StatusBadge>
                  {c.overdue ? (
                    <span className="flex items-center gap-1 text-xs text-danger">
                      <AlertTriangle className="size-3" /> Revisão vencida
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Responsável: {c.owner}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Última revisão: {c.lastReview} · Próxima revisão: {c.nextReview}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge tone={c.tone}>{c.status}</StatusBadge>
                <button
                  onClick={() => toast.success(`Evidência anexada ao controle "${c.control}".`)}
                  className="flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Paperclip className="size-3" /> Anexar evidência
                </button>
              </div>
            </div>
          </li>
        ))}
        {list.length === 0 ? (
          <li className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum controle encontrado com esses filtros.
          </li>
        ) : null}
      </ul>
    </>
  );
}
