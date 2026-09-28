import { Library } from "lucide-react";

export function WikiHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-sidebar text-sidebar-foreground">
      <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-brand/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 size-64 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative grid items-center gap-6 p-7 md:grid-cols-2 md:p-10">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wider text-sidebar-foreground/70">
            <Library className="size-3.5 text-brand" /> BASE DE CONHECIMENTO
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            Conhecimento que conecta
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-sidebar-foreground/70">
            Tudo o que você precisa saber sobre o projeto, os módulos e os processos da GWG em um
            só lugar — pesquisável, organizado e sempre atualizado.
          </p>
        </div>
        <blockquote className="hidden justify-self-end max-w-sm rounded-xl border border-white/10 bg-white/5 p-5 md:block">
          <p className="font-serif text-lg text-sidebar-foreground/90 italic">
            “Informação organizada gera decisões melhores.”
          </p>
          <footer className="mt-3 text-xs tracking-wide text-sidebar-foreground/50">
            GWG — Governança &amp; Transparência
          </footer>
        </blockquote>
      </div>
    </section>
  );
}