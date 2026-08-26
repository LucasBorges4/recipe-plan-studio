import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  CircleCheck,
  CircleDot,
  Circle,
  CircleDashed,
  User,
  Calendar,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { ProgressBar } from "@/components/portal/ProgressBar";
import {
  RecordDialog,
  DeleteRecordButton,
  useCanManageRecords,
  type FieldDef,
} from "@/components/portal/RecordForm";
import { readDocs } from "@/lib/doc-schemas";
import { usePortalData } from "@/lib/api-hooks";
import type { StatusTone } from "@/data/types";

export const Route = createFileRoute("/patente")({
  head: () => ({
    meta: [
      { title: "Patente do Sistema — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Acompanhamento das etapas do processo de patenteamento do sistema junto ao INPI.",
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

const patentFields: FieldDef[] = [
  { name: "title", label: "Etapa", type: "text", placeholder: "Ex.: Depósito no INPI" },
  { name: "description", label: "Descrição", type: "textarea" },
  { name: "owner", label: "Responsável", type: "text" },
  { name: "deadline", label: "Prazo", type: "text", placeholder: "Ex.: Mar/2026" },
  {
    name: "status",
    label: "Situação",
    type: "select",
    options: ["Concluído", "Em Andamento", "Pendente", "Aguardando"],
  },
];

function PatentePage() {
  const { data: portal, isLoading } = usePortalData();
  const canManage = useCanManageRecords();

  const stages = readDocs(portal?.docs, "patent");
  const done = stages.filter((s) => s.data.status === "Concluído").length;
  const pct = stages.length > 0 ? (done / stages.length) * 100 : 0;

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
            {done} de {stages.length} etapas concluídas
          </span>
        </div>
        <ProgressBar value={pct} className="mt-3 h-3" />
        <p className="mt-2 text-xs text-muted-foreground">{Math.round(pct)}% completo</p>
      </section>

      {canManage ? (
        <div className="mt-4 flex justify-end">
          <RecordDialog kind="patent" fields={patentFields} triggerLabel="Nova etapa" />
        </div>
      ) : null}

      <ol className="mt-6 space-y-3">
        {stages.map((s) => {
          const c = config[s.data.status] ?? config["Aguardando"]!;
          const Icon = c.icon;
          return (
            <li key={s.id} className="flex gap-4 rounded-xl border border-border bg-card p-5">
              <Icon className={`mt-0.5 size-5 shrink-0 ${c.className}`} />
              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{s.data.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{s.data.description}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="size-3" /> {s.data.owner}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" /> Prazo: {s.data.deadline}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge tone={c.tone}>{s.data.status}</StatusBadge>
                  {canManage ? (
                    <>
                      <RecordDialog
                        kind="patent"
                        fields={patentFields}
                        id={s.id}
                        initial={s.data}
                        variant="icon"
                      />
                      <DeleteRecordButton id={s.id} label={s.data.title} />
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
        {stages.length === 0 ? (
          <li className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {isLoading ? "Carregando etapas..." : "Nenhuma etapa cadastrada."}
          </li>
        ) : null}
      </ol>
    </>
  );
}
