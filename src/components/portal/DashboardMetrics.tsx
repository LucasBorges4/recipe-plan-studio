import { StatCard } from "@/components/portal/StatCard";
import { formatNextDelivery } from "@/lib/zaggo-helpers";

interface DashboardMetricsProps {
  overallPct: number;
  completedTasks: number;
  inProgressTasks: number;
  approvalPendingTasks: number;
  nextMilestoneData: { title: string; due: string } | null;
  openRisks: number;
}

export function DashboardMetrics({
  overallPct,
  completedTasks,
  inProgressTasks,
  approvalPendingTasks,
  nextMilestoneData,
  openRisks,
}: DashboardMetricsProps) {
  return (
    <div className="mb-6 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
      <StatCard
        label="Status geral"
        value={`${overallPct}%`}
        tone="brand"
        trend={overallPct > 0 ? "up" : "neutral"}
        trendValue={overallPct > 0 ? `+${Math.round(overallPct / 10)}%` : undefined}
      />
      <StatCard label="Entregues concluídas" value={completedTasks} tone="success" />
      <StatCard label="Em andamento" value={inProgressTasks} tone="info" />
      <StatCard
        label="Aguardando aprovação"
        value={approvalPendingTasks}
        tone="warning"
      />
      <StatCard
        label="Próxima entrega"
        value={nextMilestoneData ? formatNextDelivery(nextMilestoneData.due) : "—"}
        tone="brand"
      />
      <StatCard label="Chamados / Pendências" value={openRisks} tone="danger" />
    </div>
  );
}
