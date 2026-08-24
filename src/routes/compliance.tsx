import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { ShieldCheck, Paperclip, AlertTriangle, Check, X, CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { ProgressBar } from "@/components/portal/ProgressBar";
import { toast } from "sonner";
import { can } from "@/lib/rbac";
import { computeStatus, formatDateTime } from "@/lib/portal-utils";
import { usePortalData, useSession, qk } from "@/lib/api-hooks";
import { attachEvidenceFn, reviewEvidenceFn, reviewControlFn } from "@/lib/portal-api";

export const Route = createFileRoute("/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Controles de conformidade LGPD, ISO 27001 e SOX com responsáveis, evidências e vencimentos calculados.",
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
const statuses = ["Todos", "Conforme", "Próximo do vencimento", "Vencido", "Não conforme"] as const;

function CompliancePage() {
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const { data: session } = useSession();

  const controls = state?.controls ?? [];
  const evidences = state?.evidences ?? [];
  const user = session?.user ?? null;
  const may = (p: Parameters<typeof can>[1]) => !!user && can(user.role, p);

  const [norm, setNorm] = useState<(typeof norms)[number]>("Todas");
  const [status, setStatus] = useState<(typeof statuses)[number]>("Todos");

  const attachM = useMutation({
    mutationFn: (v: { controlId: string; fileName: string }) => attachEvidenceFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao anexar evidência."),
  });
  const reviewEvM = useMutation({
    mutationFn: (v: { id: string; approved: boolean; note?: string }) =>
      reviewEvidenceFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao revisar evidência."),
  });
  const reviewCtrlM = useMutation({
    mutationFn: (v: { id: string }) => reviewControlFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Revisão registrada; próxima revisão em 6 meses.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao registrar revisão."),
  });

  const computed = useMemo(
    () => controls.map((c) => ({ control: c, ...computeStatus(c) })),
    [controls],
  );

  const list = computed.filter(
    (row) =>
      (norm === "Todas" || row.control.norm === norm) &&
      (status === "Todos" || row.status === status),
  );

  const conform = computed.filter((r) => r.status === "Conforme").length;
  const overdue = computed.filter((r) => r.status === "Vencido").length;
  const pending = evidences.filter((e) => e.status === "Em revisão").length;

  function handleAttach(controlId: string, controlName: string) {
    if (!may("evidence.attach")) {
      toast.error("Seu papel não permite anexar evidências.");
      return;
    }
    attachM.mutate({ controlId, fileName: `evidencia-${Date.now()}.pdf` });
    toast.success(`Evidência enviada para revisão no controle "${controlName}".`);
  }

  function handleReview(id: string, approved: boolean) {
    if (!may("evidence.review")) {
      toast.error("Somente diretor ou administrador revisa evidências.");
      return;
    }
    reviewEvM.mutate({ id, approved });
  }

  return (
    <>
      <PageHeader
        icon={ShieldCheck}
        title="Compliance"
        subtitle="Controles, evidências e vencimentos calculados pela data atual"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Aderência geral</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {controls.length ? Math.round((conform / controls.length) * 100) : 0}%
          </p>
          <ProgressBar value={(conform / (controls.length || 1)) * 100} className="mt-3" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Revisões vencidas</p>
          <p className="mt-1 text-2xl font-semibold text-danger">{overdue}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Pendência gerada automaticamente pela data de próxima revisão
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Evidências em revisão</p>
          <p className="mt-1 text-2xl font-semibold text-warning">{pending}</p>
          <p className="mt-3 text-xs text-muted-foreground">Aguardando diretor ou administrador</p>
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
        {list.map(({ control: c, status: st, tone, daysLeft }) => {
          const items = evidences.filter((e) => e.controlId === c.id);
          return (
            <li
              key={c.id}
              className={`rounded-xl border bg-card p-5 ${st === "Vencido" || st === "Não conforme" ? "border-danger/40" : "border-border"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{c.control}</h2>
                    <StatusBadge tone="neutral">{c.norm}</StatusBadge>
                    {st === "Vencido" ? (
                      <span className="flex items-center gap-1 text-xs text-danger">
                        <AlertTriangle className="size-3" /> Revisão vencida há{" "}
                        {Math.abs(daysLeft ?? 0)} dias
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Responsável: {c.owner}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Última revisão: {c.lastReview} · Próxima revisão: {c.nextReview}
                    {daysLeft !== null && daysLeft >= 0 ? ` · faltam ${daysLeft} dias` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={tone}>{st}</StatusBadge>
                  <button
                    onClick={() => handleAttach(c.id, c.control)}
                    className="flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Paperclip className="size-3" /> Anexar evidência
                  </button>
                  {may("evidence.review") ? (
                    <button
                      onClick={() => reviewCtrlM.mutate({ id: c.id })}
                      className="flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <CalendarCheck className="size-3" /> Registrar revisão
                    </button>
                  ) : null}
                </div>
              </div>

              {items.length ? (
                <ul className="mt-4 space-y-2 border-t border-border pt-3">
                  {items.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface p-3 text-xs"
                    >
                      <span className="min-w-0">
                        <span className="text-foreground">{e.fileName}</span>
                        <span className="ml-2 text-muted-foreground">
                          enviada por {e.sentByName} em {formatDateTime(e.at)}
                          {e.reviewerName ? ` · revisada por ${e.reviewerName}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusBadge
                          tone={
                            e.status === "Aprovada"
                              ? "success"
                              : e.status === "Rejeitada"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {e.status}
                        </StatusBadge>
                        {e.status === "Em revisão" ? (
                          <>
                            <button
                              aria-label="Aprovar evidência"
                              onClick={() => handleReview(e.id, true)}
                              className="rounded-md bg-success p-1 text-success-foreground"
                            >
                              <Check className="size-3" />
                            </button>
                            <button
                              aria-label="Rejeitar evidência"
                              onClick={() => handleReview(e.id, false)}
                              className="rounded-md bg-danger p-1 text-danger-foreground"
                            >
                              <X className="size-3" />
                            </button>
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
        {list.length === 0 ? (
          <li className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum controle encontrado com esses filtros.
          </li>
        ) : null}
      </ul>
    </>
  );
}
