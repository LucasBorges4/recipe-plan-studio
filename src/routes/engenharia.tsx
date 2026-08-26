import { createFileRoute } from "@tanstack/react-router";
import { Users, Cpu } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  RecordDialog,
  DeleteRecordButton,
  useCanManageRecords,
  type FieldDef,
} from "@/components/portal/RecordForm";
import { initials } from "@/components/portal/ProgressBar";
import { readDocs } from "@/lib/doc-schemas";
import { usePortalData } from "@/lib/api-hooks";

export const Route = createFileRoute("/engenharia")({
  head: () => ({
    meta: [
      { title: "Engenharia e Equipe — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Stack tecnológica do ERP do Grupo Geos e o time de engenharia responsável pelo projeto.",
      },
      { property: "og:title", content: "Engenharia e Equipe — Grupo Geos" },
      {
        property: "og:description",
        content: "Tecnologias utilizadas e quem constrói o ERP do Grupo Geos.",
      },
    ],
  }),
  component: EngenhariaPage,
});

const techFields: FieldDef[] = [
  { name: "name", label: "Tecnologia", type: "text", placeholder: "Ex.: PostgreSQL" },
  { name: "category", label: "Categoria", type: "text", placeholder: "Ex.: Banco de dados" },
  { name: "description", label: "Descrição", type: "textarea" },
];

const memberFields: FieldDef[] = [
  { name: "name", label: "Nome", type: "text" },
  { name: "role", label: "Função", type: "text", placeholder: "Ex.: Tech Lead" },
  { name: "bio", label: "Mini biografia", type: "textarea" },
];

function EngenhariaPage() {
  const { data: portal, isLoading } = usePortalData();
  const canManage = useCanManageRecords();

  const stack = readDocs(portal?.docs, "tech");
  const team = readDocs(portal?.docs, "member");

  return (
    <>
      <PageHeader
        icon={Users}
        title="Engenharia e Equipe"
        subtitle="Stack tecnológica e time responsável pelo projeto"
      />

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Stack Tecnológica</h2>
          {canManage ? (
            <RecordDialog kind="tech" fields={techFields} triggerLabel="Nova tecnologia" />
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stack.map((t) => (
            <article key={t.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <Cpu className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{t.data.name}</p>
                  <p className="text-[11px] text-brand">{t.data.category}</p>
                </div>
                {canManage ? (
                  <span className="flex items-center">
                    <RecordDialog
                      kind="tech"
                      fields={techFields}
                      id={t.id}
                      initial={t.data}
                      variant="icon"
                    />
                    <DeleteRecordButton id={t.id} label={t.data.name} />
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t.data.description}</p>
            </article>
          ))}
          {stack.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando stack..." : "Nenhuma tecnologia cadastrada."}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Quem Somos</h2>
          {canManage ? (
            <RecordDialog kind="member" fields={memberFields} triggerLabel="Novo integrante" />
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {team.map((m) => (
            <article
              key={m.id}
              className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-sidebar text-base font-semibold text-sidebar-primary-foreground">
                {initials(m.data.name)}
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">{m.data.name}</p>
              <p className="text-xs text-brand">{m.data.role}</p>
              <p className="mt-2 text-xs text-muted-foreground">{m.data.bio}</p>
              {canManage ? (
                <div className="mt-3 flex items-center">
                  <RecordDialog
                    kind="member"
                    fields={memberFields}
                    id={m.id}
                    initial={m.data}
                    variant="icon"
                  />
                  <DeleteRecordButton id={m.id} label={m.data.name} />
                </div>
              ) : null}
            </article>
          ))}
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando equipe..." : "Nenhum integrante cadastrado."}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
