import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  KanbanSquare,
  BookOpen,
  ShieldCheck,
  Library,
  AlertTriangle,
  Users,
  FileText,
  Lock,
  BadgeCheck,
  Settings,
  PanelLeft,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const mainNav = [
  { to: "/", label: "Painel Executivo", icon: LayoutDashboard },
  { to: "/tarefas", label: "Tarefas", icon: KanbanSquare },
  { to: "/diario", label: "Diário de Bordo", icon: BookOpen },
  { to: "/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/wiki", label: "Wiki", icon: Library },
  { to: "/riscos", label: "Mapa de Riscos", icon: AlertTriangle },
  { to: "/engenharia", label: "Engenharia e Equipe", icon: Users },
] as const;

const legalNav = [
  { to: "/termos", label: "Termos de Uso", icon: FileText },
  { to: "/lgpd", label: "Política LGPD", icon: Lock },
  { to: "/patente", label: "Patente", icon: BadgeCheck },
  { to: "/admin", label: "Administração", icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {mainNav.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              activeOptions={{ exact: item.to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className: "bg-sidebar-primary text-sidebar-primary-foreground font-medium",
              }}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 mb-2 px-3 text-[11px] font-semibold tracking-widest text-sidebar-foreground/45">
        LEGAL &amp; ADMIN
      </p>
      <ul className="space-y-1">
        {legalNav.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className: "bg-sidebar-primary text-sidebar-primary-foreground font-medium",
              }}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-bold text-brand">
        G
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-sidebar-primary-foreground">Grupo Geos</p>
        <p className="truncate text-[11px] text-sidebar-foreground/60">Portal de Governança</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex lg:fixed lg:inset-y-0">
        <Brand />
        <NavList />
        <p className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-foreground/40">
          © 2026 Grupo Geos
        </p>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-64 flex-col bg-sidebar">
            <button
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 text-sidebar-foreground/70"
            >
              <X className="size-4" />
            </button>
            <Brand />
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className={cn("flex min-w-0 flex-1 flex-col lg:pl-64")}>
        <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:px-8">
          <button
            aria-label="Abrir menu"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setOpen(true)}
          >
            <PanelLeft className="size-4" />
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
