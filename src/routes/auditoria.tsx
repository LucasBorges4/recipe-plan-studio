import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import {
  ScrollText,
  ShieldAlert,
  Download,
  FileText,
  Users,
  CheckCircle2,
  AlertTriangle,
  Search,
  Calendar,
  Grid3x3,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { userCan, auditableRoleLabel, roleLabel } from "@/lib/rbac";
import { formatDateTime } from "@/lib/portal-utils";
import { useAuditList, useSession } from "@/lib/api-hooks";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/lib/records";

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — Portal de Governança GWG — Grupo W. Geotec" },
      {
        name: "description",
        content:
          "Trilha de auditoria do portal: quem fez, quando fez, o que mudou e por quê, em registro somente-inserção.",
      },
      { property: "og:title", content: "Auditoria — GWG — Grupo W. Geotec" },
      {
        property: "og:description",
        content: "Histórico imutável de ações sobre tarefas, controles e evidências.",
      },
    ],
  }),
  component: AuditoriaPage,
});

/* ------------------------------------------------------------------ */
/* Classificação da ação (Aprovação, Atualização, Upload, Crítica)     */
/* ------------------------------------------------------------------ */

type AuditType = "aprovacao" | "atualizacao" | "upload" | "critica";

const TYPE_META: Record<
  AuditType,
  { label: string; badge: string; dot: string }
> = {
  aprovacao: {
    label: "Aprovação",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  atualizacao: {
    label: "Atualização",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
    dot: "bg-blue-500",
  },
  upload: {
    label: "Upload",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25",
    dot: "bg-purple-500",
  },
  critica: {
    label: "Crítica",
    badge: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25",
    dot: "bg-red-500",
  },
};

function auditType(a: AuditEntry): AuditType {
  const s = a.action.toLowerCase();
  if (/aprova|rejeit|recus|validou/.test(s)) return "aprovacao";
  if (/upload|anex|arquivo|evidênc|imagem/.test(s)) return "upload";
  if (/exclu|remov|permiss|revoga|falha|desatrel|bloque|redefin|papel|conta criada/.test(s))
    return "critica";
  return "atualizacao";
}

function AuditTypeBadge({ type }: { type: AuditType }) {
  const meta = TYPE_META[type];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* KPIs calculados com dados reais                                     */
/* ------------------------------------------------------------------ */

function diffToPrev30(cur: number, from30: number) {
  if (from30 === 0) {
    return cur > 0 ? { dir: "up" as const, label: "— novo" } : { dir: "neutral" as const, label: "— sem variação" };
  }
  const pct = Math.round(((cur - from30) / from30) * 100);
  if (pct === 0) return { dir: "neutral" as const, label: "— sem variação" };
  return {
    dir: (pct > 0 ? "up" : "down") as "up" | "down",
    label: `${pct > 0 ? "+" : ""}${pct}% no último mês`,
  };
}

function countSince(rows: AuditEntry[], from: number): number {
  const cutoff = Date.now() - from * 24 * 60 * 60 * 1000;
  return rows.filter((a) => new Date(a.at).getTime() >= cutoff).length;
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
];

function AuditoriaPage() {
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const allowed = !!user && userCan(user, "audit.read");
  const { data: res } = useAuditList(allowed);
  const audit = res?.ok ? res.data : [];

  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("30");
  const [userFilter, setUserFilter] = useState("Todos");
  const [moduleFilter, setModuleFilter] = useState("Todos");
  const [expanded, setExpanded] = useState<string | null>(null);

  const users = useMemo(
    () => ["Todos", ...Array.from(new Set(audit.map((a) => a.actor))).sort()],
    [audit],
  );
  const modules = useMemo(
    () => ["Todos", ...Array.from(new Set(audit.map((a) => a.entity))).sort()],
    [audit],
  );

  const cutoff = period === "all" ? 0 : Number(period) * 24 * 60 * 60 * 1000;
  const baseList = audit.filter(
    (a) =>
      (cutoff === 0 || new Date(a.at).getTime() >= Date.now() - cutoff) &&
      (userFilter === "Todos" || a.actor === userFilter) &&
      (moduleFilter === "Todos" || a.entity === moduleFilter) &&
      (query.trim() === "" ||
        `${a.action} ${a.actor} ${a.entity} ${a.entityId}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())),
  );

  /* KPIs reais */
  const kpis = useMemo(() => {
    const total = audit.length;
    const activeUsers = new Set(
      audit.map((a) => (a.actorId ? `id:${a.actorId}` : `name:${a.actor}`)),
    ).size;
    const aprovals = audit.filter((a) => auditType(a) === "aprovacao").length;
    const criticals = audit.filter((a) => auditType(a) === "critica").length;

    const prevMonth = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const lastMonth = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const totalPrev = audit.filter((a) => {
      const t = new Date(a.at).getTime();
      return t >= prevMonth && t < lastMonth;
    }).length;

    const aprovalsLast30 = countSince(audit.filter((a) => auditType(a) === "aprovacao"), 30);
    const aprovalsPrev30 = audit.filter((a) => {
      const t = new Date(a.at).getTime();
      return auditType(a) === "aprovacao" && t >= prevMonth && t < lastMonth;
    }).length;

    const critsLast30 = countSince(audit.filter((a) => auditType(a) === "critica"), 30);
    const critsPrev30 = audit.filter((a) => {
      const t = new Date(a.at).getTime();
      return auditType(a) === "critica" && t >= prevMonth && t < lastMonth;
    }).length;

    return [
      {
        id: "total",
        icon: FileText,
        label: "Ações registradas",
        value: total,
        trend: diffToPrev30(countSince(audit, 30), totalPrev),
      },
      {
        id: "users",
        icon: Users,
        label: "Usuários ativos",
        value: activeUsers,
        trend: { dir: "neutral" as const, label: "— no período" },
      },
      {
        id: "aprovacoes",
        icon: CheckCircle2,
        label: "Aprovações realizadas",
        value: aprovals,
        trend: diffToPrev30(aprovalsLast30, aprovalsPrev30),
      },
      {
        id: "criticas",
        icon: AlertTriangle,
        label: "Alterações críticas",
        value: criticals,
        invert: true,
        trend: diffToPrev30(critsLast30, critsPrev30),
      },
    ];
  }, [audit]);

  if (!allowed) {
    return (
      <>
        <PageHeader icon={ScrollText} title="Auditoria" subtitle="Trilha de registro do portal" />
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto size-6 text-warning" />
          <p className="mt-3 text-sm font-medium text-foreground">Acesso restrito</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A trilha de auditoria é visível a administrador, diretor, auditor e visualizador. Você
            está como{" "}
            {user ? `${user.name} (${roleLabel[user.role]})` : "usuário não autenticado"}.
          </p>
        </div>
      </>
    );
  }

  function exportReport() {
    const rows = [
      ["data", "autor", "papel", "ação", "tipo", "módulo", "id", "antes", "depois", "motivo"],
      ...baseList.map((a) => [
        a.at,
        a.actor,
        auditableRoleLabel[a.actorRole] ?? a.actorRole,
        a.action,
        TYPE_META[auditType(a)].label,
        a.entity,
        a.entityId,
        a.before ?? "",
        a.after ?? "",
        a.reason ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `auditoria-gwg-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        icon={ScrollText}
        title="Auditoria"
        subtitle="Rastreabilidade das principais ações realizadas no portal."
        actions={
          <button
            onClick={exportReport}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
          >
            <Download className="size-4" /> Exportar relatório
          </button>
        }
      />

      {/* ---- KPIs ---- */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const bad = k.trend.dir === "up" && k.invert;
          const good = k.trend.dir === "down" && k.invert;
          const up = k.trend.dir === "up" && !k.invert;
          const down = k.trend.dir === "down" && !k.invert;
          return (
            <div
              key={k.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{k.label}</p>
                <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-foreground">
                  {k.value}
                </p>
                <p
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11px] font-semibold",
                    k.trend.dir === "neutral"
                      ? "text-muted-foreground"
                      : up || good
                        ? "bg-success-soft text-success"
                        : "bg-danger-soft text-danger",
                  )}
                >
                  {k.trend.dir === "up" && <ChevronRight className="size-3 rotate-90" />}
                  {k.trend.dir === "down" && <ChevronRight className="size-3 -rotate-90" />}
                  {k.trend.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Filtros ---- */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ação, usuário ou palavra-chave..."
            className="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Período"
            className="w-full appearance-none rounded-md border border-input bg-background py-2 pr-8 pl-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="relative">
          <Users className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            aria-label="Usuário"
            className="w-full appearance-none rounded-md border border-input bg-background py-2 pr-8 pl-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {users.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="relative">
          <Grid3x3 className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            aria-label="Módulo"
            className="w-full appearance-none rounded-md border border-input bg-background py-2 pr-8 pl-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {modules.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {baseList.length} registro(s) · histórico somente-inserção, inalterável.
      </p>

      {/* ---- Tabela ---- */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              {["Data e hora", "Usuário", "Ação realizada", "Módulo", "Status", "Ver detalhes"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {baseList.map((a) => {
              const type = auditType(a);
              const open = expanded === a.id;
              return (
                <Fragment key={a.id}>
                  <tr
                    className={cn(
                      "border-b border-border/60 text-sm text-foreground last:border-0",
                      expanded === a.id && "bg-brand/5",
                    )}
                  >
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateTime(a.at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-foreground">{a.actor}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {auditableRoleLabel[a.actorRole] ?? a.actorRole}
                      </span>
                    </td>
                    <td className="px-4 py-3">{a.action}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone="neutral">{a.entity}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <AuditTypeBadge type={type} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(open ? null : a.id)}
                        aria-expanded={open}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand underline-offset-2 hover:underline"
                      >
                        {open ? "Ocultar" : "Ver detalhes"}
                        <ChevronRight
                          className={cn("size-3.5 transition-transform", open && "rotate-90")}
                        />
                      </button>
                    </td>
                  </tr>
                  {open ? (
                    <tr key={`${a.id}-detail`} className="border-b border-border/60 bg-surface/60 last:border-0">
                      <td colSpan={6} className="px-4 py-4">
                        <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                          <div>
                            <dt className="font-medium text-foreground">Registro</dt>
                            <dd className="mt-0.5 break-all">{a.id}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-foreground">Entidade</dt>
                            <dd className="mt-0.5">
                              {a.entity} <span className="text-muted-foreground/60">#{a.entityId}</span>
                            </dd>
                          </div>
                          <div>
                            <dt className="font-medium text-foreground">Papel do autor</dt>
                            <dd className="mt-0.5">
                              {auditableRoleLabel[a.actorRole] ?? a.actorRole}
                            </dd>
                          </div>
                          {a.before || a.after ? (
                            <div className="sm:col-span-2">
                              <dt className="font-medium text-foreground">Alteração</dt>
                              <dd className="mt-0.5">
                                <span className="text-muted-foreground">{a.before ?? "—"}</span>
                                {" → "}
                                <span className="font-medium text-foreground">
                                  {a.after ?? "—"}
                                </span>
                              </dd>
                            </div>
                          ) : null}
                          {a.reason ? (
                            <div>
                              <dt className="font-medium text-foreground">Motivo</dt>
                              <dd className="mt-0.5">{a.reason}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {baseList.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma ação registrada neste filtro. Movimente uma tarefa ou envie uma evidência para
            começar a trilha.
          </div>
        ) : null}
      </div>
    </>
  );
}