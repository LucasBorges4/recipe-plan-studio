import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard, Boxes, Calendar, ArrowUpRight, Gauge } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { ProgressBar } from "@/components/portal/ProgressBar";
import { usePortalData } from "@/lib/api-hooks";
import { formatBR } from "@/lib/doc-schemas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel Executivo — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Visão geral do progresso do projeto ERP do Grupo Geos: termômetro do projeto, status dos módulos e próximos passos.",
      },
      { property: "og:title", content: "Painel Executivo — Grupo Geos" },
      {
        property: "og:description",
        content: "Progresso consolidado dos módulos do ERP e próximos passos do projeto.",
      },
    ],
  }),
  component: Index,
});

function Gauge0({ value }: { value: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex size-48 items-center justify-center">
      <svg viewBox="0 0 160 160" className="size-full -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          strokeWidth="14"
          className="stroke-neutral-soft"
        />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          className="stroke-brand transition-all"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-semibold text-foreground">{Math.round(value)}%</p>
        <p className="text-xs text-muted-foreground">concluído</p>
      </div>
    </div>
  );
}

function Index() {
  const { data: state } = usePortalData();
  const tasks = state?.tasks ?? [];
  const auditCount = state?.auditCount ?? 0;
  const mods = state?.modules ?? [];
  const nextSteps = state?.nextSteps ?? [];

  const done = mods.reduce((s, m) => s + m.done, 0);
  const total = mods.reduce((s, m) => s + m.total, 0);
  const pct = total ? (done / total) * 100 : 0;

  const todayIso = new Date().toISOString().slice(0, 10);
  const kpis = [
    {
      label: "Concluídas",
      value: tasks.filter((t) => t.column === "Concluído").length,
      tone: "text-success",
    },
    {
      label: "Em progresso",
      value: tasks.filter((t) => t.column === "Em Progresso").length,
      tone: "text-info",
    },
    {
      label: "Em aprovação",
      value: tasks.filter((t) => t.column === "Em Aprovação").length,
      tone: "text-warning",
    },
    {
      label: "Atrasadas",
      value: tasks.filter((t) => {
        const iso = t.due ? t.due.split("/").reverse().join("-") : null;
        return !!iso && iso < todayIso && t.column !== "Concluído";
      }).length,
      tone: "text-danger",
    },
  ];

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Painel Executivo"
        subtitle="Visão geral do progresso do projeto ERP"
      />
      <NoticeBanner />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            to="/tarefas"
            className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand"
          >
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${k.tone}`}>{k.value}</p>
          </Link>
        ))}
      </div>
      <div className="mb-6 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        {auditCount
          ? `${auditCount} ação(ões) registradas na trilha de auditoria.`
          : "Nenhuma ação registrada ainda — cada movimentação passa a constar na Auditoria."}{" "}
        <Link to="/auditoria" className="text-brand">
          Ver auditoria
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gauge className="size-4 text-brand" /> Termômetro do Projeto
          </h2>
          <div className="mt-6 flex flex-col items-center">
            <Gauge0 value={pct} />
            <p className="mt-6 text-center text-xs text-muted-foreground">
              {done} de {total} entregáveis concluídos em {mods.length} módulos
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Boxes className="size-4 text-brand" /> Módulos do Sistema
            </h2>
            <StatusBadge tone="brand">{mods.length} módulos</StatusBadge>
          </div>

          {mods.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
              Nenhum módulo cadastrado. Crie em <Link to="/admin" className="text-brand">Administração → Módulos</Link>.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {mods.map((m) => {
                const mp = m.total ? (m.done / m.total) * 100 : 0;
                return (
                  <li key={m.id}>
                    <Link
                      to="/tarefas"
                      className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                          <StatusBadge tone={m.tone}>{m.status}</StatusBadge>
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="size-3" /> {formatBR(m.date)}
                        </span>
                      </span>
                      <span className="flex w-40 items-center gap-2">
                        <span className="w-8 text-right text-xs font-medium text-foreground">
                          {m.done}/{m.total}
                        </span>
                        <ProgressBar value={mp} className="flex-1" />
                        <ArrowUpRight className="size-3.5 text-muted-foreground" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Próximos Passos</h2>
        {nextSteps.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            Nenhum próximo passo cadastrado. Crie em <Link to="/admin" className="text-brand">Administração</Link>.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {nextSteps.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="mt-3 flex items-center gap-1 text-xs text-brand">
                  <Calendar className="size-3" /> {formatBR(s.due)} · {s.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
