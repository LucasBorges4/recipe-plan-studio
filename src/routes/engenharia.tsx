import { createFileRoute } from "@tanstack/react-router";
import { Users, Linkedin, Mail, Cpu } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { stack, team } from "@/data/team";
import { initials } from "@/components/portal/ProgressBar";

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
  return (
    <>
      <PageHeader
        icon={Users}
        title="Engenharia e Equipe"
        subtitle="Stack tecnológica e time responsável pelo projeto"
      />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Stack Tecnológica</h2>
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
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Quem Somos</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {team.map((m) => (
            <article
              key={m.name}
              className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-sidebar text-base font-semibold text-sidebar-primary-foreground">
                {initials(m.name)}
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">{m.name}</p>
              <p className="text-xs text-brand">{m.role}</p>
              <p className="mt-2 text-xs text-muted-foreground">{m.bio}</p>
              <div className="mt-4 flex gap-3">
                {m.links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${l.label} de ${m.name}`}
                    className="text-muted-foreground transition-colors hover:text-brand"
                  >
                    {l.label === "LinkedIn" ? (
                      <Linkedin className="size-4" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
