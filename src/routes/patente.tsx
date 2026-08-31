import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CircleCheck,
  CircleDot,
  Circle,
  CircleDashed,
  User,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { ProgressBar } from "@/components/portal/ProgressBar";
import { patentStages as seedPatent } from "@/data/patent";
import type { PatentStage, StatusTone } from "@/data/types";
import { can } from "@/lib/rbac";
import { usePortalData, useSession, qk } from "@/lib/api-hooks";
import { updatePatentStageFn } from "@/lib/portal-api";

export const Route = createFileRoute("/patente")({
  head: () => ({
    meta: [
      { title: "Patente do Sistema — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Acompanhamento das 7 etapas do processo de patenteamento do sistema junto ao INPI.",
      },
      { property: "og:title", content: "Patente do Sistema — Grupo Geos" },
      {
        property: "og:description",
        content: "Progresso do pedido de patente do ERP do Grupo Geos no INPI.",
      },
    ],
  }),
  component: PatentePage,
});

const config: Record<string, { tone: StatusTone; icon: typeof CircleCheck; className: string }> = {
  Concluído: { tone: "success", icon: CircleCheck, className: "text-success" },
  "Em Andamento": { tone: "info", icon: CircleDot, className: "text-info" },
  Pendente: { tone: "warning", icon: Circle, className: "text-warning" },
  Aguardando: { tone: "neutral", icon: CircleDashed, className: "text-muted-foreground" },
};

function PatentePage() {
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const { data: session } = useSession();
  const patentStages = state?.patentStages ?? seedPatent;
  const mayManage = !!session?.user && can(session.user.role, "patent.manage");
  const done = patentStages.filter((s) => s.status === "Concluído").length;
  const pct = (done / patentStages.length) * 100;

  const updateM = useMutation({
    mutationFn: (v: { id: string; status: PatentStage["status"] }) =>
      updatePatentStageFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Etapa atualizada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar etapa."),
  });

  return (
    <>
      <PageHeader
        icon={BadgeCheck}
        title="Patente do Sistema"
        subtitle="Acompanhamento do processo de patenteamento junto ao INPI"
      />
      <NoticeBanner />

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Progresso Geral</h2>
          <span className="text-xs text-muted-foreground">
            {done} de {patentStages.length} etapas concluídas
          </span>
        </div>
        <ProgressBar value={pct} className="mt-3 h-3" />
        <p className="mt-2 text-xs text-muted-foreground">{Math.round(pct)}% completo</p>
      </section>

      <ol className="mt-6 space-y-3">
        {patentStages.map((s) => {
          const c = config[s.status] ?? config["Aguardando"]!;
          const Icon = c.icon;
          return (
            <li key={s.id} className="flex gap-4 rounded-xl border border-border bg-card p-5">
              <Icon className={`mt-0.5 size-5 shrink-0 ${c.className}`} />
              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="size-3" /> {s.owner}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" /> Prazo: {s.deadline}
                    </span>
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <StatusBadge tone={c.tone}>{s.status}</StatusBadge>
                  {mayManage ? (
                    <select
                      value={s.status}
                      onChange={(e) =>
                        updateM.mutate({
                          id: s.id,
                          status: e.target.value as PatentStage["status"],
                        })
                      }
                      className="rounded-md border border-input bg-card px-2 py-1 text-xs"
                      aria-label={`Status de ${s.title}`}
                    >
                      <option>Concluído</option>
                      <option>Em Andamento</option>
                      <option>Pendente</option>
                      <option>Aguardando</option>
                    </select>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
