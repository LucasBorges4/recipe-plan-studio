import { createFileRoute } from "@tanstack/react-router";
import { Users, Cpu, Mail } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { initials } from "@/components/portal/ProgressBar";
import { usePortalData, usePublicUsers } from "@/lib/api-hooks";
import { roleLabel } from "@/lib/rbac";

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

function EngenhariaPage() {
  const { data: state } = usePortalData();
  const { data: usersRes } = usePublicUsers();
  const stack = state?.techStack ?? [];
  const users = usersRes?.ok ? usersRes.data : [];
  return (
    <>
      <PageHeader
        icon={Users}
        title="Engenharia e Equipe"
        subtitle="Stack tecnológica e time responsável pelo projeto"
      />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Stack Tecnológica</h2>
        {stack.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma tecnologia cadastrada.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stack.map((t) => (
            <article key={t.name} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <Cpu className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-[11px] text-brand">{t.category}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t.description}</p>
            </article>
          ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Quem Somos</h2>
        {users.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum usuário cadastrado ainda.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {users.map((u) => (
              <article
                key={u.id}
                className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-sidebar text-base font-semibold text-sidebar-primary-foreground">
                  {initials(u.name)}
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground">{u.name}</p>
                <StatusBadge tone="brand" className="mt-1">{roleLabel[u.role]}</StatusBadge>
                {u.jobTitle ? <p className="mt-1 text-xs text-muted-foreground">{u.jobTitle}</p> : null}
                {u.department ? <p className="text-xs text-muted-foreground">{u.department}</p> : null}
                {u.bio ? <p className="mt-2 text-xs text-muted-foreground">{u.bio}</p> : <p className="mt-2 text-xs italic text-muted-foreground">Sem bio — edite em /perfil.</p>}
                <a href={`mailto:${u.email}`} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
                  <Mail className="size-3" /> {u.email}
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
