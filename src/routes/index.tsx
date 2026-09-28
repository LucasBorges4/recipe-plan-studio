import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LayoutGrid,
  CalendarDays,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  Send,
  Users,
  MessageSquare,
  Download,
} from "lucide-react";

import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { ActionBar } from "@/components/portal/ActionBar";

import { usePortalData, usePublicUsers, useSession, useAuditList } from "@/lib/api-hooks";
import { buildTeamCatalog } from "@/lib/team-photos";
import {
  calculateOverallPct,
  countCompletedTasks,
  countInProgressTasks,
  countApprovalPendingTasks,
  getNextMilestone,
  countOpenRisks,
} from "@/lib/zaggo-helpers";

import { DashboardMetrics } from "@/components/portal/DashboardMetrics";
import { ProjectProgress } from "@/components/portal/ProjectProgress";
import { UpcomingDeliveries } from "@/components/portal/UpcomingDeliveries";
import { TeamSection } from "@/components/portal/TeamSection";
import { RecentActivity } from "@/components/portal/RecentActivity";
import { PointsOfAttention } from "@/components/portal/PointsOfAttention";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel Executivo | ZAGGO" },
      {
        name: "description",
        content:
          "Painel Executivo do Portal de Gestão ZAGGO — GWG: indicadores reais, progresso de módulos, próximas entregas e equipe responsável.",
      },
      { property: "og:title", content: "Painel Executivo | ZAGGO — GWG" },
      {
        property: "og:description",
        content: "Visão consolidada do progresso, entregas e equipe do projeto ZAGGO.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "Visitante";
  const { data: state } = usePortalData();
  const { data: usersRes } = usePublicUsers();
  const { data: auditRes } = useAuditList(true);

  const tasks = state?.tasks ?? [];
  const mods = state?.modules ?? [];
  const nextSteps = state?.nextSteps ?? [];
  const milestones = state?.milestones ?? [];
  const risks = state?.risks ?? [];
  const auditCount = state?.auditCount ?? 0;
  const columns = state?.columns ?? [];

  const auditEntries = auditRes?.ok ? auditRes.data : [];
  const publicUsers = usersRes?.ok ? usersRes.data : [];

  const teamList = useMemo(() => {
    const rank: Record<string, number> = { lead: 0, secondary: 1 };
    return buildTeamCatalog()
      .filter((m) => m.group === "projeto")
      .sort((a, b) => (rank[a.tier] ?? 2) - (rank[b.tier] ?? 2));
  }, []);

  const done = mods.reduce((s, m) => s + m.done, 0);
  const total = mods.reduce((s, m) => s + m.total, 0);
  const overallPct = calculateOverallPct(mods);

  const completedTasks = countCompletedTasks(tasks);
  const inProgressTasks = countInProgressTasks(tasks, columns);
  const approvalPendingTasks = countApprovalPendingTasks(tasks);
  const backlogTasks = tasks.filter((t) => t.column === "Backlog").length;
  const openRisks = countOpenRisks(risks);
  const nextMilestoneData = getNextMilestone(milestones, nextSteps);

  const [periodText, setPeriodText] = useState("01 jan 2026 - 31 jan 2026");
  const [moduleText, setModuleText] = useState("Todos os módulos");

  const lastAudits = useMemo(() => auditEntries.slice(0, 5), [auditEntries]);

  const upcomingSteps = useMemo(() => {
    const all: { id?: string; title?: string; name?: string; kind: "milestone" | "step"; due: string; status?: string; type?: string }[] = [
      ...milestones.map((m) => ({
        id: m.id,
        title: m.title,
        kind: "milestone" as const,
        due: m.date,
        status: m.type,
      })),
      ...nextSteps.map((s) => ({
        id: s.id,
        title: s.title,
        kind: "step" as const,
        due: s.due,
        status: s.status,
      })),
    ];
    const future = all.filter((item) => {
      const d = new Date(item.due.split("/").reverse().join("-") + "T00:00:00");
      return !isNaN(d.getTime()) && d >= new Date();
    });
    future.sort((a, b) => {
      const da = new Date(a.due.split("/").reverse().join("-") + "T00:00:00");
      const db = new Date(b.due.split("/").reverse().join("-") + "T00:00:00");
      return da.getTime() - db.getTime();
    });
    return future.slice(0, 5);
  }, [milestones, nextSteps]);

  const [showFilter, setShowFilter] = useState(false);

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Acompanhamento do seu projeto"
        subtitle={
          <span className="flex items-center gap-2">
            <span>Visão consolidada de entregas, módulos e equipe</span>
            <span className="text-brand">·</span>
            <span className="italic text-muted-foreground/80">
              Parceria para transformar ideias em resultados.
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden md:flex md:items-center md:gap-2">
              <button
                type="button"
                onClick={() => {
                  setPeriodText(
                    periodText === "01 jan 2026 - 31 jan 2026"
                      ? "01 fev 2026 - 28 fev 2026"
                      : "01 jan 2026 - 31 jan 2026",
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Alterar período"
              >
                <CalendarDays className="size-3.5" />
                <span>{periodText}</span>
                <ChevronRight className="size-3" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setModuleText(
                    moduleText === "Todos os módulos" ? "Compliance" : "Todos os módulos",
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Filtrar módulo"
              >
                <LayoutGrid className="size-3.5" />
                <span>Módulo: {moduleText}</span>
                <Filter className="size-3" />
              </button>
            </div>
          </div>
        }
      />
      <NoticeBanner />

      {/* Saudação */}
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-full bg-brand-soft p-2.5 shadow-sm">
          <LayoutDashboard className="size-5 text-brand" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-foreground">Olá, {userName}!</h2>
          <p className="text-xs text-muted-foreground">
            Aqui está o resumo do projeto — dados reais, sem estimativas fictícias.
          </p>
        </div>
      </div>

      <DashboardMetrics
        overallPct={overallPct}
        completedTasks={completedTasks}
        inProgressTasks={inProgressTasks}
        approvalPendingTasks={approvalPendingTasks}
        nextMilestoneData={nextMilestoneData}
        openRisks={openRisks}
      />

      {/* Resumo rápido */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-4 px-5 py-3.5 text-xs text-muted-foreground rounded-xl border border-border bg-card">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-brand" />
            {auditCount
              ? `${auditCount} ação(ões) registrada(s) na auditoria.`
              : "Nenhuma ação registrada ainda — cada movimentação passa a constar na Auditoria."}
          </span>
          {auditCount > 0 && (
            <Link
              to="/auditoria"
              className="font-medium text-brand hover:underline underline-offset-2"
            >
              Ver auditoria
            </Link>
          )}
        </div>
      </div>

      {/* Linha 2 — 3 blocos */}
      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <ProjectProgress
          mods={mods}
          inProgressTasks={inProgressTasks}
          completedTasks={completedTasks}
          approvalPendingTasks={approvalPendingTasks}
          backlogTasks={backlogTasks}
        />
        <UpcomingDeliveries upcomingSteps={upcomingSteps} />
        <TeamSection teamList={teamList} />
      </div>

      {/* Linha 3 — 2 blocos */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <RecentActivity lastAudits={lastAudits} />
        <PointsOfAttention risks={risks} approvalPendingTasks={approvalPendingTasks} />
      </div>

      {/* Barra de Ações Rápidas */}
      <ActionBar>
        <Link
          to="/tarefas"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-extrabold text-brand-foreground shadow-lg shadow-brand/20 hover:bg-brand/95 transition-all"
        >
          <LayoutGrid className="size-3.5" /> Ver entregas / tarefas
        </Link>
        <Link
          to="/tarefas"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-sm hover:bg-surface transition-colors"
        >
          <CheckCircle2 className="size-3.5 text-success" /> Aprovar item
        </Link>
        <button
          type="button"
          onClick={() =>
            alert("Envio de arquivo demonstrativo: funcionalidade disponível no ambiente real.")
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-sm hover:bg-surface transition-colors"
        >
          <Send className="size-3.5 text-brand" /> Enviar arquivo
        </button>
        <Link
          to="/equipe"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-sm hover:bg-surface transition-colors"
        >
          <Users className="size-3.5 text-info" /> Falar com a equipe
        </Link>
        <button
          type="button"
          onClick={() =>
            alert(
              "Solicitação demonstrativa: registre um chamado real no módulo de tarefas para confirmar.",
            )
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-sm hover:bg-surface transition-colors"
        >
          <MessageSquare className="size-3.5 text-warning" /> Abrir solicitação
        </button>
        <button
          type="button"
          onClick={() => {
            const resumo = `Portal ZAGGO — GWG
Resumo do projeto (dados reais):
- Módulos: ${mods.map((m) => m.name).join(", ") || "Nenhum"}
- Status geral: ${overallPct}% (${done}/${total})
- Tarefas concluídas: ${completedTasks}
- Em andamento: ${inProgressTasks}
- Aguardando aprovação: ${approvalPendingTasks}
- Próxima entrega: ${nextMilestoneData ? `${nextMilestoneData.title} (${nextMilestoneData.due})` : "—"}
- Riscos abertos: ${openRisks}
- Equipe: ${publicUsers.map((u) => u.name).join(", ") || "Nenhum usuário público"}`;
            const blob = new Blob([resumo], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `resumo-zaggo-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand-soft px-3.5 py-2 text-xs font-extrabold text-brand hover:bg-brand-soft/60 transition-colors"
        >
          <Download className="size-3.5" /> Baixar relatório
        </button>
      </ActionBar>
    </>
  );
}
