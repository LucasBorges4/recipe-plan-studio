import { Link, useLocation, createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/api-hooks";
import {
  LayoutDashboard,
  KanbanSquare,
  BookOpen,
  UsersRound,
  AlertTriangle,
  ShieldCheck,
  Bot,
  Library,
  ScrollText,
  FileText,
  Lock,
  Search,
  Bell,
  ChevronDown,
  GraduationCap,
  BarChart2,
  Lightbulb,
  ExternalLink,
  Laptop,
  Info,
  Zap,
  PanelLeft,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mainNav = [
  { to: "/", label: "Painel Executivo", icon: LayoutDashboard },
  { to: "/tarefas", label: "Tarefas", icon: KanbanSquare },
  { to: "/diario", label: "Diário de Bordo", icon: BookOpen },
  { to: "/equipe", label: "Equipe", icon: UsersRound },
  { to: "/riscos", label: "Mapa de Riscos", icon: AlertTriangle },
  { to: "/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/mentoria", label: "Mentoria IA", icon: Zap },
  { to: "/wiki", label: "Wiki", icon: Library },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText },
  { to: "/lgpd", label: "Privacidade e LGPD", icon: Lock },
  { to: "/termos", label: "Termos de Uso", icon: FileText },
] as const;

function Brand() {
  return (
    <div className="flex flex-col items-start gap-1 px-5 py-5 border-b border-sidebar-border">
      <Link to="/" className="flex items-center gap-2">
        <span className="text-xl font-bold text-sidebar-primary-foreground tracking-tight">ZAGGO</span>
      </Link>
      <p className="text-[11px] text-sidebar-foreground/50 tracking-wide ml-1">Representações</p>
    </div>
  );
}

function NavList() {
  const location = useLocation();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {mainNav.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-all duration-200",
                  isActive
                    ? "bg-brand/20 text-brand font-semibold shadow-sm shadow-brand/20 relative"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 bg-brand rounded-r-full" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-sidebar-border px-5 py-4">
      <p className="text-[11px] text-sidebar-foreground/40 text-center">Solução desenvolvida pela</p>
      <Link to="/" className="mt-1 flex items-center justify-center gap-2">
        <span className="text-sm font-semibold text-sidebar-primary-foreground">GWG</span>
        <span className="text-[10px] text-sidebar-foreground/50">Geotecnologias Aplicadas à Vida Real</span>
      </Link>
    </div>
  );
}

function SearchBar() {
  return (
    <div className="relative flex-1 max-w-xl">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Pesquisar entregas, arquivos, mensagens..."
        className="w-full pl-10 pr-3 py-2 text-sm bg-background border-border focus:ring-brand"
      />
    </div>
  );
}

function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 pr-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/zaggo-mark.png" alt="Pedrão ZAGGO" />
            <AvatarFallback>PZ</AvatarFallback>
          </Avatar>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-foreground">Pedrão ZAGGO</p>
            <p className="text-[11px] text-muted-foreground">Cliente</p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="flex items-center gap-2">
          <LayoutDashboard className="size-4" /> Perfil
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2">
          <Settings className="size-4" /> Configurações
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 text-destructive">
          <LogOut className="size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header() {
  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-background px-4 lg:px-8">
      <button className="lg:hidden text-muted-foreground" aria-label="Abrir menu">
        <PanelLeft className="size-5" />
      </button>
      <SearchBar />
      <div className="flex items-center gap-4 ml-auto">
        <button className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Bell className="size-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

const featureCards = [
  {
    icon: GraduationCap,
    iconColor: "text-brand",
    title: "Conteúdo prático",
    description: "Aulas e exercícios focados na aplicação real.",
  },
  {
    icon: BarChart2,
    iconColor: "text-success",
    title: "Acompanhamento na plataforma externa",
    description: "Acesse seus materiais e acompanhe sua evolução.",
  },
  {
    icon: Lightbulb,
    iconColor: "text-warning",
    title: "Material aplicado à realidade da ZAGGO",
    description: "Conteúdo direcionado aos desafios do seu dia a dia.",
  },
];

export default function MentoriaPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "Pedrão";

  return (
    <div className="flex min-h-screen bg-surface">
      <Header />

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8 lg:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
            <section className="space-y-6">
              <Card className="shadow-sm border-border bg-white">
                <CardContent className="pt-6">
                  <div className="mb-6">
                    <p className="text-lg font-semibold text-foreground">Olá, {userName.split(" ")[0]}!</p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Mentoria IA</h1>
                    <p className="mt-2 text-base text-muted-foreground max-w-2xl">
                      Acesse o portal de aprendizado e acompanhe sua evolução na mentoria de Inteligência Artificial.
                    </p>
                  </div>

                  <div className="border-t border-border pt-6">
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">PORTAL DE APRENDIZADO</p>
                      <h2 className="mt-1 text-2xl font-bold text-foreground">Acesse o portal da mentoria</h2>
                      <p className="mt-2 text-base text-muted-foreground max-w-xl">
                        Na plataforma da mentoria você pode acessar as aulas, materiais, exercícios e acompanhar sua evolução diretamente na plataforma da mentoria.
                      </p>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      <div className="flex-1">
                        <Button
                          asChild
                          size="lg"
                          className="h-14 px-6 bg-brand text-brand-foreground font-semibold shadow-sm hover:shadow-md hover:bg-brand/90 transition-all"
                        >
                          <Link to="#" className="flex items-center gap-2">
                            <ExternalLink className="size-4" />
                            Acessar portal da mentoria
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
                        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                          <Info className="size-4 text-info" />
                          Ao clicar, você será direcionado para uma plataforma externa desenvolvida em R, onde está hospedada a mentoria.
                        </p>
                      </div>
                      <div className="relative hidden lg:block w-80">
                        <div className="relative aspect-[4/3] rounded-xl bg-gradient-to-br from-muted via-muted/50 to-background shadow-xl shadow-black/5 ring-1 ring-border overflow-hidden">
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <Laptop className="size-16 text-muted-foreground/30 mb-4" />
                            <div className="w-full max-w-xs bg-white rounded-lg p-4 shadow-lg border border-border">
                              <div className="text-center">
                                <p className="text-lg font-bold text-foreground">ZAGGO Mentoria IA</p>
                                <p className="text-sm text-muted-foreground mt-1">Aprendizado prático para aplicação no seu dia a dia</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <div className="space-y-4">
              {featureCards.map((card, index) => (
                <Card key={index} className="shadow-sm border-border bg-white hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                        <card.icon className={cn("size-6", card.iconColor)} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/mentoria")({
  component: MentoriaPage,
});