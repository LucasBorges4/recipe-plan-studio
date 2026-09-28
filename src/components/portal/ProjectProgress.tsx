import { DonutChart } from "@/components/portal/DonutChart";
import { Gauge } from "lucide-react";
import { SectionHeader } from "@/components/portal/SectionHeader";
import { PanelCard } from "@/components/portal/PanelCard";
import type { Module } from "@/data/types";
import { useMemo } from "react";
import { calculateOverallPct } from "@/lib/zaggo-helpers";

interface ProjectProgressProps {
  mods: Module[];
  inProgressTasks: number;
  completedTasks: number;
  approvalPendingTasks: number;
  backlogTasks: number;
}

export function ProjectProgress({
  mods,
  inProgressTasks,
  completedTasks,
  approvalPendingTasks,
  backlogTasks,
}: ProjectProgressProps) {
  const done = mods.reduce((s, m) => s + m.done, 0);
  const total = mods.reduce((s, m) => s + m.total, 0);

  const segments = useMemo(
    () => [
      {
        label: "Concluído",
        value: mods.reduce((s, m) => s + m.done, 0),
        total,
        color: "#10b981",
      },
      {
        label: "Em andamento",
        value: inProgressTasks,
        total: inProgressTasks + completedTasks + approvalPendingTasks + backlogTasks || 1,
        color: "#3b82f6",
      },
      {
        label: "Aguardando aprovação",
        value: approvalPendingTasks,
        total: approvalPendingTasks + completedTasks + inProgressTasks || 1,
        color: "#f59e0b",
      },
      {
        label: "Não iniciado",
        value: backlogTasks,
        total: backlogTasks + inProgressTasks + completedTasks + approvalPendingTasks || 1,
        color: "#94a3b8",
      },
    ],
    [mods, inProgressTasks, completedTasks, approvalPendingTasks, backlogTasks, total],
  );

  return (
    <PanelCard>
      <SectionHeader
        title="Progresso do Projeto"
        subtitle="Distribuição real dos módulos e entregáveis"
        icon={Gauge}
      />
      <div className="flex flex-col items-center">
        <DonutChart
          value={done}
          max={total || 1}
          size={170}
          strokeWidth={16}
          sublabel={`${done} de ${total} entregáveis`}
        />
      </div>
      <div className="mt-4 space-y-2.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {seg.label}
            </span>
            <span className="text-muted-foreground">{seg.value > 0 ? seg.value : 0}</span>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}
