import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ClipboardList,
  ShieldCheck,
  AlertTriangle,
  ScrollText,
  Zap,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { WikiArticle } from "@/data/types";

const QUICK_LINKS = [
  { label: "Tarefas", desc: "Quadro Kanban de atividades", to: "/tarefas", icon: ClipboardList },
  { label: "Compliance", desc: "Controles e prazos de revisão", to: "/compliance", icon: ShieldCheck },
  { label: "Mapa de Riscos", desc: "Matriz de calor por impacto", to: "/riscos", icon: AlertTriangle },
  { label: "Trilha de Auditoria", desc: "Histórico imutável de ações", to: "/auditoria", icon: ScrollText },
  { label: "Automações", desc: "Workflows e integrações n8n", to: "/automacoes", icon: Zap },
  { label: "Diário de Bordo", desc: "Reuniões e decisões do projeto", to: "/diario", icon: BookOpen },
] as const;

export function WikiSidebar({ featured }: { featured: WikiArticle[] }) {
  return (
    <aside className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-foreground">
          Artigos em Destaque
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </h2>
        <div className="scrollbar-thin flex snap-x gap-3 overflow-x-auto rounded-xl border border-border bg-card p-3 md:flex-col md:overflow-x-visible">
          {featured.map((a) => (
            <Link
              key={a.slug}
              to="/wiki/$slug"
              params={{ slug: a.slug }}
              className="group flex min-w-56 snap-start flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors md:min-w-0 md:border-0 md:border-b md:border-border/60 md:py-3 md:last:border-0"
            >
              <span className="text-xs font-medium text-brand">{a.category}</span>
              <span className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-brand">
                {a.title}
              </span>
              <span className="mt-1 text-[11px] text-muted-foreground">
                {a.updatedBy ?? "Equipe GWG"} · {a.version}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Links Rápidos</h2>
        <ul className="flex flex-col gap-1">
          {QUICK_LINKS.map((q) => (
            <li key={q.to}>
              <Link
                to={q.to}
                className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-brand">
                    <q.icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">{q.label}</span>
                    <span className="block text-xs text-muted-foreground">{q.desc}</span>
                  </span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative overflow-hidden rounded-xl border border-white/10 bg-sidebar p-6 text-sidebar-foreground">
        <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-brand/25 blur-2xl" />
        <p className="font-serif text-lg text-sidebar-foreground/90 italic">
          “Documentar hoje é agilidade amanhã.”
        </p>
        <p className="mt-3 text-xs tracking-wide text-sidebar-foreground/50">
          GWG — Base de Conhecimento
        </p>
      </section>
    </aside>
  );
}