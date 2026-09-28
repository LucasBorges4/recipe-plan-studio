import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { severityLabel, severityTone } from "@/lib/portal-utils";
import { userCan, roleLabel, roles } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { usePortalData, useSession, qk } from "@/lib/api-hooks";
import {
  createRiskFn,
  deleteRiskFn,
  generateAutoRisksFn,
  updateRiskFn,
} from "@/lib/portal-api";
import { cn } from "@/lib/utils";
import type { RiskStatus, Risk } from "@/data/types";

export const Route = createFileRoute("/riscos")({
  head: () => ({
    meta: [
      { title: "Mapa de Riscos — Portal de Governança GWG — Grupo W. Geotec" },
      {
        name: "description",
        content:
          "Matriz de probabilidade e impacto dos riscos do projeto ERP, com donos e planos de mitigação.",
      },
      { property: "og:title", content: "Mapa de Riscos — GWG — Grupo W. Geotec" },
      {
        property: "og:description",
        content: "Riscos técnicos, legais e de prazo com severidade calculada.",
      },
    ],
  }),
  component: RiscosPage,
});

/* ------------------------------------------------------------------ */
/* Status config                                                       */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS: {
  value: NonNullable<RiskStatus>;
  label: string;
  tone: "info" | "danger" | "warning" | "success" | "brand";
}[] = [
  { value: "ativo", label: "Ativo", tone: "info" },
  { value: "critico", label: "Crítico", tone: "danger" },
  { value: "em_tratamento", label: "Em Tratamento", tone: "warning" },
  { value: "mitigado", label: "Mitigado", tone: "success" },
  { value: "pendente_cliente", label: "Pendente do Cliente", tone: "brand" },
];

const STATUS_MAP = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s]),
) as Record<string, (typeof STATUS_OPTIONS)[number]>;

function statusTone(status?: RiskStatus): "info" | "danger" | "warning" | "success" | "brand" | "neutral" {
  return status ? (STATUS_MAP[status]?.tone ?? "neutral") : "info";
}

function statusLabel(status?: RiskStatus): string {
  return status ? (STATUS_MAP[status]?.label ?? status) : "Ativo";
}

/* ------------------------------------------------------------------ */
/* Cell tone                                                           */
/* ------------------------------------------------------------------ */

const cellTone = (score: number) =>
  score >= 15
    ? "bg-danger-soft"
    : score >= 9
      ? "bg-warning-soft"
      : score >= 4
        ? "bg-info-soft"
        : "bg-success-soft";

/* ------------------------------------------------------------------ */
/* Inline edit form                                                    */
/* ------------------------------------------------------------------ */

function RiskEditForm({
  risk,
  tasks,
  onSave,
  onCancel,
  isPending,
}: {
  risk: Risk;
  tasks: { id: string; title: string }[];
  onSave: (patch: Partial<Risk>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [status, setStatus] = useState<NonNullable<RiskStatus>>(risk.status ?? "ativo");
  const [nextAction, setNextAction] = useState(risk.nextAction ?? "");
  const [due, setDue] = useState(risk.due ?? "");
  const [taskId, setTaskId] = useState(risk.taskId ?? "");

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-brand/30 bg-brand/5 p-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-foreground">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as NonNullable<RiskStatus>)}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-xs"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-foreground">Prazo</span>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs sm:col-span-2">
        <span className="font-medium text-foreground">Próxima ação</span>
        <input
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder="Ex.: Reunião de alinhamento, revisão de escopo..."
          className="rounded-md border border-input bg-card px-2 py-1.5 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs sm:col-span-2">
        <span className="font-medium text-foreground">Vincular tarefa</span>
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value || "")}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-xs"
        >
          <option value="">Nenhuma</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          onClick={() =>
            onSave({
              status,
              nextAction: nextAction.trim(),
              due: due || null,
              taskId: taskId || null,
            })
          }
          disabled={isPending}
          className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-50"
        >
          <Check className="size-3" />
          {isPending ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" /> Cancelar
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

function RiscosPage() {
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const { data: session } = useSession();
  const risks = state?.risks ?? [];
  const tasks = state?.tasks ?? [];
  const mayManage = !!session?.user && userCan(session.user, "risk.manage");
  const isSuperior =
    !!session?.user && (session.user.role === "admin" || session.user.role === "diretor");
  const isEmpty = risks.length === 0;

  /* ---- filters ---- */
  const [cell, setCell] = useState<{ p: number; i: number } | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "Todas">("Todas");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [editingId, setEditingId] = useState<string | null>(null);

  /* ---- create form ---- */
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [owner, setOwner] = useState("");
  const [newRole, setNewRole] = useState<Role>(session?.user?.role ?? "gestor");
  const [mitigation, setMitigation] = useState("");
  const [newProb, setNewProb] = useState(3);
  const [newImpact, setNewImpact] = useState(3);
  const [newStatus, setNewStatus] = useState<NonNullable<RiskStatus>>("ativo");
  const [newNextAction, setNewNextAction] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newTaskId, setNewTaskId] = useState("");

  /* ---- derived lists ---- */
  const filteredByRole =
    roleFilter === "Todas" ? risks : risks.filter((r) => r.role === roleFilter);
  const filteredByStatus =
    statusFilter === "Todos"
      ? filteredByRole
      : filteredByRole.filter((r) => (r.status ?? "ativo") === statusFilter);
  const list = cell
    ? filteredByStatus.filter((r) => r.probability === cell.p && r.impact === cell.i)
    : filteredByStatus;

  /* ---- status counts ---- */
  const statusCounts = (() => {
    const m: Record<string, number> = {
      ativo: 0,
      critico: 0,
      em_tratamento: 0,
      mitigado: 0,
      pendente_cliente: 0,
    };
    for (const r of risks) m[r.status ?? "ativo"] = (m[r.status ?? "ativo"] ?? 0) + 1;
    return m;
  })();

  const byRole = (() => {
    const m = new Map<string, number>();
    for (const r of risks) m.set(r.role, (m.get(r.role) ?? 0) + 1);
    return Array.from(m.entries());
  })();

  /* ---- mutations ---- */
  const createM = useMutation({
    mutationFn: (v: Parameters<typeof createRiskFn>[0]["data"]) =>
      createRiskFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Risco criado.");
      setShowForm(false);
      setTitle("");
      setCategory("");
      setOwner("");
      setMitigation("");
      setNewNextAction("");
      setNewDue("");
      setNewTaskId("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar risco."),
  });

  const updateM = useMutation({
    mutationFn: (v: Parameters<typeof updateRiskFn>[0]["data"]) =>
      updateRiskFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Risco atualizado.");
      setEditingId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar risco."),
  });

  const deleteM = useMutation({
    mutationFn: (v: { id: string }) => deleteRiskFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Risco removido.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  const autoM = useMutation({
    mutationFn: () => generateAutoRisksFn(),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(
          r.data.created
            ? `${r.data.created} risco(s) gerado(s).`
            : "Nenhum novo risco — sistema limpo.",
        );
        qc.invalidateQueries({ queryKey: qk.portal });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar."),
  });

  return (
    <>
      <PageHeader
        icon={AlertTriangle}
        title="Mapa de Riscos"
        subtitle="Probabilidade x impacto dos riscos do projeto"
      />
      <NoticeBanner />

      {/* ---- Summary cards ---- */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() =>
              setStatusFilter(statusFilter === s.value ? "Todos" : s.value)
            }
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              statusFilter === s.value
                ? "border-brand ring-1 ring-brand"
                : "border-border bg-card hover:border-brand/40",
            )}
          >
            <div className="flex items-center gap-2">
              <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
            </div>
            <p className="mt-1.5 text-2xl font-bold text-foreground">
              {statusCounts[s.value]}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {s.value === "pendente_cliente" ? "Aguardando ação" : "riscos"}
            </p>
          </button>
        ))}
      </div>

      {/* ---- Admin controls ---- */}
      {mayManage ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
          >
            <Plus className="size-3" /> Novo risco
          </button>
          <button
            onClick={() => autoM.mutate()}
            disabled={autoM.isPending}
            className="flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {autoM.isPending ? "Gerando..." : "↻ Gerar automaticamente"}
          </button>
          <span className="text-xs text-muted-foreground">
            Dados persistidos no backend com auditoria.
          </span>
        </div>
      ) : null}

      {/* ---- Create form ---- */}
      {showForm ? (
        <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs sm:col-span-3"
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
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="text-muted-foreground">
                Probabilidade: {newProb}
              </span>
              <input
                type="range"
                min={1}
                max={5}
                value={newProb}
                onChange={(e) => setNewProb(Number(e.target.value))}
                className="w-full"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Impacto: {newImpact}</span>
              <input
                type="range"
                min={1}
                max={5}
                value={newImpact}
                onChange={(e) => setNewImpact(Number(e.target.value))}
                className="w-full"
              />
            </label>
          </div>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as NonNullable<RiskStatus>)}
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
            placeholder="Prazo"
          />
          <select
            value={newTaskId}
            onChange={(e) => setNewTaskId(e.target.value)}
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
          >
            <option value="">Vincular tarefa (opcional)</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <input
            value={newNextAction}
            onChange={(e) => setNewNextAction(e.target.value)}
            placeholder="Próxima ação"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs sm:col-span-2"
          />
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
                probability: newProb,
                impact: newImpact,
                mitigation: mitigation.trim(),
                status: newStatus,
                nextAction: newNextAction.trim() || undefined,
                due: newDue || null,
                taskId: newTaskId || null,
              })
            }
            className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50 sm:col-span-3"
          >
            {createM.isPending ? "Salvando..." : "Salvar risco"}
          </button>
        </div>
      ) : null}

      {/* ---- Filters ---- */}
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
        {statusFilter !== "Todos" && (
          <button
            onClick={() => setStatusFilter("Todos")}
            className="flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1 text-xs text-brand"
          >
            {STATUS_MAP[statusFilter]?.label}
            <X className="size-3" />
          </button>
        )}
        {byRole.map(([role, count]) => (
          <span
            key={role}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
          >
            {roleLabel[role as Role] ?? role}:{" "}
            <span className="font-semibold text-foreground">{count}</span>
          </span>
        ))}
        {!isSuperior && session?.user ? (
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs text-brand">
            Sua visão: {roleLabel[session.user.role]}
          </span>
        ) : null}
      </div>

      {/* ---- Matrix + List ---- */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Matriz 5×5</h2>
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
                    const inCell = filteredByStatus.filter(
                      (r) => r.probability === p && r.impact === i,
                    );
                    const selected = cell?.p === p && cell?.i === i;
                    return (
                      <div
                        key={`${p}-${i}`}
                        className={cn(
                          "relative flex h-14 items-center justify-center rounded-md text-xs font-semibold text-foreground/70 transition-all",
                          cellTone(score),
                          selected && "ring-2 ring-brand",
                        )}
                      >
                        {/* Background count */}
                        <button
                          onClick={() => setCell(selected ? null : { p, i })}
                          className="absolute inset-0 flex items-center justify-center"
                          aria-label={`Probabilidade ${p}, impacto ${i} — ${inCell.length} risco(s)`}
                        >
                          {inCell.length > 0 ? inCell.length : ""}
                        </button>
                        {/* Clickable dots */}
                        {inCell.length > 0 && (
                          <div className="absolute bottom-1 left-1 flex flex-wrap gap-0.5">
                            {inCell.slice(0, 6).map((r) =>
                              r.taskId ? (
                                <Link
                                  key={r.id}
                                  to="/tarefas"
                                  search={{ task: r.taskId }}
                                  onClick={(e) => e.stopPropagation()}
                                  className={cn(
                                    "block h-2 w-2 rounded-full ring-1 ring-white/50 hover:ring-2 hover:ring-brand",
                                  )}
                                  style={{
                                    backgroundColor: `var(--color-${statusTone(r.status)}-fg, var(--color-brand))`,
                                  }}
                                  title={`${r.title} — ${statusLabel(r.status)} — Ver tarefa`}
                                />
                              ) : (
                                <span
                                  key={r.id}
                                  className={cn(
                                    "block h-2 w-2 rounded-full ring-1 ring-white/50",
                                  )}
                                  style={{
                                    backgroundColor: `var(--color-${statusTone(r.status)}-fg, var(--color-brand))`,
                                  }}
                                  title={`${r.title} — ${statusLabel(r.status)}`}
                                />
                              ),
                            )}
                            {inCell.length > 6 && (
                              <span className="text-[8px] leading-none text-foreground/50">
                                +{inCell.length - 6}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
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
            Clique em uma célula para filtrar. Pontos coloridos = riscos; clicar abre a tarefa
            vinculada.
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

        {/* ---- Risk list ---- */}
        <section className="space-y-3">
          {list.map((r) => {
            const score = r.probability * r.impact;
            const isEditing = editingId === r.id;
            return (
              <article
                key={r.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {r.title}
                  </h2>
                  <span className="flex items-center gap-2">
                    <StatusBadge tone={statusTone(r.status)}>
                      {statusLabel(r.status)}
                    </StatusBadge>
                    <StatusBadge tone="brand">
                      {roleLabel[r.role as Role] ?? r.role}
                    </StatusBadge>
                    <StatusBadge tone={severityTone(score)}>
                      {severityLabel(score)} · {score}
                    </StatusBadge>
                    {mayManage ? (
                      <>
                        <button
                          aria-label="Editar risco"
                          onClick={() =>
                            setEditingId(isEditing ? null : r.id)
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          aria-label="Remover risco"
                          onClick={() => deleteM.mutate({ id: r.id })}
                          className="text-muted-foreground hover:text-danger"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.category} · Dono: {r.owner} · Papel:{" "}
                  {roleLabel[r.role as Role] ?? r.role} · P{r.probability} × I
                  {r.impact}
                </p>

                {/* Next action */}
                {r.nextAction && (
                  <p className="mt-1.5 text-xs">
                    <span className="font-medium text-foreground">
                      Próxima ação:{" "}
                    </span>
                    <span className="text-muted-foreground">
                      {r.nextAction}
                    </span>
                  </p>
                )}

                {/* Due date */}
                {r.due && (
                  <p className="mt-1 text-xs">
                    <span className="font-medium text-foreground">Prazo: </span>
                    <span
                      className={cn(
                        "text-muted-foreground",
                        new Date(r.due) < new Date() && "font-medium text-danger",
                      )}
                    >
                      {new Date(r.due + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </p>
                )}

                {/* Task link */}
                {r.taskId && (() => {
                  const task = tasks.find((t) => t.id === r.taskId);
                  return task ? (
                    <p className="mt-1.5 text-xs">
                      <Link
                        to="/tarefas"
                        search={{ task: r.taskId! }}
                        className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        {task.title}
                      </Link>
                    </p>
                  ) : null;
                })()}

                {/* Mitigation */}
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Mitigação: </span>
                  {r.mitigation}
                </p>

                {/* Edit form */}
                {isEditing && mayManage && (
                  <RiskEditForm
                    risk={r}
                    tasks={tasks}
                    onSave={(patch) =>
                      updateM.mutate({ id: r.id, ...patch } as Parameters<typeof updateRiskFn>[0]["data"])
                    }
                    onCancel={() => setEditingId(null)}
                    isPending={updateM.isPending}
                  />
                )}
              </article>
            );
          })}
          {list.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {isEmpty
                ? "Plataforma limpa — nenhum risco cadastrado ainda. Crie o primeiro risco (gestor/diretor/admin)."
                : "Nenhum risco nesta combinação de filtros."}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
