import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Tag } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import {
  RecordDialog,
  DeleteRecordButton,
  useCanManageRecords,
  type FieldDef,
} from "@/components/portal/RecordForm";
import { readDocs } from "@/lib/doc-schemas";
import { usePortalData } from "@/lib/api-hooks";
import type { StatusTone } from "@/data/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/diario")({
  head: () => ({
    meta: [
      { title: "Diário de Bordo — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content: "Marcos, entregas e evolução do projeto ERP do Grupo Geos, com release notes.",
      },
      { property: "og:title", content: "Diário de Bordo — Grupo Geos" },
      {
        property: "og:description",
        content: "Histórico de marcos, integrações e decisões do projeto.",
      },
    ],
  }),
  component: DiarioPage,
});

const typeTone: Record<string, StatusTone> = {
  Entrega: "success",
  Integração: "info",
  Marco: "brand",
  Decisão: "warning",
};

const filters = ["Todos", "Entrega", "Integração", "Marco", "Decisão"] as const;

const milestoneFields: FieldDef[] = [
  { name: "date", label: "Data", type: "text", placeholder: "Ex.: 12 Fev 2026" },
  {
    name: "type",
    label: "Tipo",
    type: "select",
    options: ["Entrega", "Integração", "Marco", "Decisão"],
  },
  { name: "title", label: "Título", type: "text" },
  { name: "description", label: "Descrição", type: "textarea" },
];

const releaseFields: FieldDef[] = [
  { name: "version", label: "Versão", type: "text", placeholder: "Ex.: v2.4.0" },
  { name: "date", label: "Data", type: "text", placeholder: "Ex.: 10 Fev 2026" },
  { name: "items", label: "Itens da release", type: "list", placeholder: "Novo relatório..." },
];

function DiarioPage() {
  const { data: portal, isLoading } = usePortalData();
  const canManage = useCanManageRecords();
  const [filter, setFilter] = useState<(typeof filters)[number]>("Todos");

  const milestones = readDocs(portal?.docs, "milestone");
  const releases = readDocs(portal?.docs, "release");
  const list = milestones.filter((m) => filter === "Todos" || m.data.type === filter);

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Diário de Bordo"
        subtitle="Marcos, entregas e evolução do projeto"
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
        {canManage ? (
          <span className="ml-auto flex gap-2">
            <RecordDialog kind="milestone" fields={milestoneFields} triggerLabel="Novo marco" />
            <RecordDialog kind="release" fields={releaseFields} triggerLabel="Nova release" />
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ol className="relative rounded-xl border border-border bg-card p-6">
          {list.map((m, i) => (
            <li key={m.id} className="relative flex gap-4 pb-8 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Tag className="size-3.5" />
                </span>
                {i < list.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{m.data.date}</span>
                  <StatusBadge tone={typeTone[m.data.type] ?? "neutral"}>{m.data.type}</StatusBadge>
                  {canManage ? (
                    <span className="ml-auto flex items-center">
                      <RecordDialog
                        kind="milestone"
                        fields={milestoneFields}
                        id={m.id}
                        initial={m.data}
                        variant="icon"
                      />
                      <DeleteRecordButton id={m.id} label={m.data.title} />
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1 text-base font-semibold text-foreground">{m.data.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{m.data.description}</p>
              </div>
            </li>
          ))}
          {list.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? "Carregando marcos..." : "Nenhum evento neste filtro."}
            </li>
          ) : null}
        </ol>

        <aside className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Release Notes</h2>
          <ul className="mt-4 space-y-4">
            {releases.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-brand">{r.data.version}</span>
                  <span className="text-xs text-muted-foreground">{r.data.date}</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {r.data.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                {canManage ? (
                  <div className="mt-2 flex justify-end">
                    <RecordDialog
                      kind="release"
                      fields={releaseFields}
                      id={r.id}
                      initial={r.data}
                      variant="icon"
                    />
                    <DeleteRecordButton id={r.id} label={r.data.version} />
                  </div>
                ) : null}
              </li>
            ))}
            {releases.length === 0 ? (
              <li className="text-xs text-muted-foreground">
                {isLoading ? "Carregando..." : "Nenhuma release publicada."}
              </li>
            ) : null}
          </ul>
        </aside>
      </div>
    </>
  );
}
