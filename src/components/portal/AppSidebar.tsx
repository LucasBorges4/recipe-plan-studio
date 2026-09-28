import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  KanbanSquare,
  BookOpen,
  ShieldCheck,
  Library,
  AlertTriangle,
  User,
  FileText,
  Lock,
  Settings,
  PanelLeft,
  ScrollText,
  Bot,
  X,
  Search,
  UsersRound,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { roleLabel, menuAllowed } from "@/lib/rbac";
import { useGlobalSearch } from "@/lib/api-hooks";
import { useSession, qk } from "@/lib/api-hooks";
import { logoutFn } from "@/lib/portal-api";
import { useRouteGuard } from "@/lib/page-guard";

const mainNav = [
  { to: "/", label: "Painel Executivo", icon: LayoutDashboard },
  { to: "/equipe", label: "Equipe do Projeto", icon: UsersRound },
  { to: "/tarefas", label: "Tarefas", icon: KanbanSquare },
  { to: "/automacoes", label: "Automações", icon: Bot },
  { to: "/diario", label: "Diário de Bordo", icon: BookOpen },
  { to: "/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/wiki", label: "Wiki", icon: Library },
  { to: "/riscos", label: "Mapa de Riscos", icon: AlertTriangle },
  { to: "/perfil", label: "Meu Perfil", icon: User },
] as const;

const legalNav = [
  { to: "/auditoria", label: "Auditoria", icon: ScrollText },
  { to: "/termos", label: "Termos de Uso", icon: FileText },
  { to: "/lgpd", label: "Política LGPD", icon: Lock },
  { to: "/admin", label: "Administração", icon: Settings },
] as const;

function SessionBox() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const logout = useMutation({
    mutationFn: () => logoutFn(),
    onSuccess: async () => {
      queryClient.setQueryData(qk.session, { user: null, persistent: session?.persistent ?? true });
      await queryClient.invalidateQueries({ queryKey: qk.portal });
      await queryClient.invalidateQueries({ queryKey: qk.audit });
      await queryClient.invalidateQueries({ queryKey: qk.users });
      toast.success("Sessão encerrada.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao sair."),
  });

  if (!session?.user) {
    return (
      <div className="border-t border-sidebar-border/60 px-4 py-5">
        <Link
          to="/login"
          className="flex items-center justify-center gap-2 rounded-full border-2 border-[#0fb3b3]/60 bg-transparent px-4 py-2.5 text-sm font-semibold text-[#0fb3b3] transition-all duration-200 hover:bg-[#0fb3b3]/15 hover:border-[#0fb3b3] hover:text-[#1a5c5c] active:scale-[0.98]"
        >
          <LogIn className="size-4" /> Entrar
        </Link>
      </div>
    );
  }

  const user = session.user;
  return (
    <div className="border-t border-sidebar-border/60 px-4 py-5">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#0fb3b3] to-[#1a5c5c] text-white shadow-lg shadow-[#0fb3b3]/30 ring-2 ring-[#0fb3b3]/20 ring-offset-1 ring-offset-sidebar">
            <User className="size-5" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-sidebar-primary-foreground tracking-tight">Administrador</p>
          <p className="truncate text-[11px] text-sidebar-foreground/60">Administrador - {roleLabel[user.role]}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#0fb3b3]/60 bg-transparent px-4 py-2 text-sm font-semibold text-[#0fb3b3] transition-all duration-200 hover:bg-[#0fb3b3]/15 hover:border-[#0fb3b3] hover:text-[#1a5c5c] active:scale-[0.98]"
      >
        <LogOut className="size-4" /> {logout.isPending ? "Saindo..." : "Sair"}
      </button>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const filteredMain = mainNav.filter((item) => (userRole ? menuAllowed(userRole, item.to) : true));
  const filteredLegal = legalNav.filter((item) =>
    userRole ? menuAllowed(userRole, item.to) : true,
  );

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {filteredMain.map((item) => {
          const isHome = item.to === "/";
          const label = userRole === "cliente" && isHome ? "Acompanhamento" : item.label;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                activeOptions={{ exact: item.to === "/" }}
                className="flex items-center gap-3 rounded-lg border border-transparent px-3.5 py-2.5 text-sm text-sidebar-foreground/90 transition-all duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:shadow-sm hover:-translate-y-px"
                activeProps={{
                  className: "bg-gradient-to-r from-[#1a5c5c] to-[#1a6e6e] text-white font-semibold shadow-md shadow-[#1a5c5c]/40 relative overflow-hidden border-l-[3px] border-[#0fb3b3]",
                }}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 mb-2 px-3 text-[11px] font-semibold tracking-widest text-sidebar-foreground/45">
        LEGAL &amp; ADMIN
      </p>
      <ul className="space-y-1">
        {filteredLegal.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg border border-transparent px-3.5 py-2.5 text-sm text-sidebar-foreground/85 transition-all duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:shadow-sm hover:-translate-y-px"
              activeProps={{
                className: "bg-gradient-to-r from-[#1a5c5c] to-[#1a6e6e] text-white font-semibold shadow-md shadow-[#1a5c5c]/40 relative overflow-hidden border-l-[3px] border-[#0fb3b3]",
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
    <div className="flex items-center gap-3.5 border-b border-sidebar-border px-5 py-5">
      <img
        src="/zaggo-mark.png"
        alt="ZAGGO"
        className="size-11 shrink-0 rounded-lg bg-white/10 object-contain p-1 shadow-lg shadow-black/20 ring-1 ring-white/10"
      />
      <div className="min-w-0">
        <p className="truncate text-base font-extrabold tracking-tight text-sidebar-primary-foreground leading-tight">GRUPO GWG</p>
        <p className="truncate text-[11px] font-medium text-sidebar-foreground/50 tracking-wide">Portal de Governança</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useRouteGuard();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const search = useGlobalSearch(searchQuery);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex lg:fixed lg:inset-y-0">
        <Brand />
        <NavList />
        <SessionBox />
        <p className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-foreground/40">
          © 2026 GRUPO GWG
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
            <SessionBox />
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
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar…"
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
