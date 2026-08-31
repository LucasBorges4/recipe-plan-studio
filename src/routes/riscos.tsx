import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { severityLabel, severityTone } from "@/lib/portal-utils";
import { can, roleLabel, roles } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { usePortalData, useSession, qk } from "@/lib/api-hooks";
import { createRiskFn, deleteRiskFn } from "@/lib/portal-api";
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
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const { data: session } = useSession();
  const risks = state?.risks ?? [];
  const mayManage = !!session?.user && can(session.user.role, "risk.manage");
  const isSuperior = !!session?.user && (session.user.role === "admin" || session.user.role === "diretor");
  const isEmpty = risks.length === 0;
  const [cell, setCell] = useState<{ p: number; i: number } | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "Todas">("Todas");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [owner, setOwner] = useState("");
  const [newRole, setNewRole] = useState<Role>(session?.user?.role ?? "gestor");
  const [mitigation, setMitigation] = useState("");
  const filteredByRole = roleFilter === "Todas" ? risks : risks.filter((r) => r.role === roleFilter);
  const list = cell ? filteredByRole.filter((r) => r.probability === cell.p && r.impact === cell.i) : filteredByRole;
  const byRole = (() => {
    const m = new Map<string, number>();
    for (const r of risks) m.set(r.role, (m.get(r.role) ?? 0) + 1);
    return Array.from(m.entries());
  })();

  const createM = useMutation({
    mutationFn: (v: {
      title: string;
      category: string;
      owner: string;
      role: Role;
      probability: number;
      impact: number;
      mitigation: string;
    }) => createRiskFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Risco criado.");
      setShowForm(false);
      setTitle("");
      setCategory("");
      setOwner("");
      setMitigation("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar risco."),
  });
  const deleteM = useMutation({
    mutationFn: (v: { id: string }) => deleteRiskFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Risco removido.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  return (
    <>
      <PageHeader
        icon={AlertTriangle}
        title="Mapa de Riscos"
        subtitle="Probabilidade x impacto dos riscos do projeto"
      />
      <NoticeBanner />
      {mayManage ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
          >
            <Plus className="size-3" /> Novo risco
          </button>
          <span className="text-xs text-muted-foreground">
            Dados persistidos no backend com auditoria.
          </span>
        </div>
      ) : null}
      {showForm ? (
        <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
          />
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Responsável"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
          <input
            value={mitigation}
            onChange={(e) => setMitigation(e.target.value)}
            placeholder="Mitigação"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs sm:col-span-2"
          />
          <button
            disabled={createM.isPending || !title.trim() || !mitigation.trim()}
            onClick={() =>
              createM.mutate({
                title: title.trim(),
                category: category.trim() || "Geral",
                owner: owner.trim() || session?.user?.name || "—",
                role: newRole,
                probability: 3,
                impact: 3,
                mitigation: mitigation.trim(),
              })
            }
            className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50 sm:col-span-2"
          >
            {createM.isPending ? "Salvando..." : "Salvar risco"}
          </button>
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "Todas")}
          className="rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground"
          aria-label="Filtrar por papel"
        >
          <option>Todas</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {roleLabel[r]}
            </option>
          ))}
        </select>
        {byRole.map(([role, count]) => (
          <span key={role} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            {roleLabel[role as Role] ?? role}: <span className="font-semibold text-foreground">{count}</span>
          </span>
        ))}
        {!isSuperior && session?.user ? (
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs text-brand">Sua visão: {roleLabel[session.user.role]}</span>
        ) : null}
      </div>

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
                    const inCell = filteredByRole.filter((r) => r.probability === p && r.impact === i);
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
                  <span className="flex items-center gap-2">
                    <StatusBadge tone="brand">{roleLabel[r.role as Role] ?? r.role}</StatusBadge>
                    <StatusBadge tone={severityTone(score)}>
                      {severityLabel(score)} · {score}
                    </StatusBadge>
                    {mayManage ? (
                      <button
                        aria-label="Remover risco"
                        onClick={() => deleteM.mutate({ id: r.id })}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.category} · Dono: {r.owner} · Papel: {roleLabel[r.role as Role] ?? r.role} · P{r.probability} x I{r.impact}
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
              {isEmpty
                ? "Plataforma limpa — nenhum risco cadastrado ainda. Crie o primeiro risco (gestor/diretor/admin)."
                : "Nenhum risco nesta combinação de probabilidade e impacto."}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
