import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Clock,
  Eye,
  MousePointerClick,
  RefreshCw,
  Route as RouteIcon,
  Users,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { PanelCard } from "@/components/portal/PanelCard";
import { useSession } from "@/lib/api-hooks";
import { canViewAnalytics, roleLabel, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Comportamento em Tempo Real — Portal ZAGGO" },
      {
        name: "description",
        content:
          "Telemetria anonimizada de navegação: páginas, sessões, cliques, funil e sinais de atrito em tempo real.",
      },
    ],
  }),
  component: AnalyticsPage,
});

interface SummaryKpis {
  events: string | number;
  sessions: string | number;
  users: string | number;
  avg_duration_ms: number | string;
  avg_scroll_pct: number | string;
  rage_clicks: string | number;
}

interface Summary {
  enabled: boolean;
  reason?: string;
  generatedAt?: string;
  windowMinutes?: number;
  kpis?: SummaryKpis;
  timeseries?: Array<{ bucket: string; events: string | number; sessions: string | number }>;
  topPages?: Array<{ path: string; views: string | number; sessions: string | number }>;
  topClicks?: Array<{ element: string; clicks: string | number; rage_clicks: string | number }>;
  recent?: Array<{
    event: string;
    path: string;
    role: string | null;
    device: string | null;
    event_ts: string;
  }>;
  funnel?: Array<{ step: string; sessions: string | number }>;
  roles?: Array<{
    role: string;
    events: string | number;
    sessions: string | number;
    users: string | number;
  }>;
  activeUsers?: Array<{
    user_id: string;
    role: string | null;
    events: string | number;
    sessions: string | number;
    last_seen: string;
  }>;
}

const PERIODS = [
  { label: "15 min", minutes: 15 },
  { label: "1 h", minutes: 60 },
  { label: "4 h", minutes: 240 },
  { label: "24 h", minutes: 1440 },
] as const;

const EVENT_TONE: Record<string, string> = {
  page_view: "bg-info/10 text-info",
  page_leave: "bg-muted text-muted-foreground",
  click: "bg-brand-soft text-brand",
  rage_click: "bg-danger/10 text-danger",
  task_open: "bg-warning/10 text-warning",
  task_create: "bg-success/10 text-success",
  task_move: "bg-success/10 text-success",
  login: "bg-success/10 text-success",
  logout: "bg-muted text-muted-foreground",
  error: "bg-danger/10 text-danger",
  search: "bg-info/10 text-info",
};

function n(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

function formatTime(value: string): string {
  try {
    return new Date(value).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function roleName(value: string | null | undefined): string {
  if (!value || value === "anon") return "Anônimo";
  return roleLabel[value as Role] ?? value;
}

function shortUserId(value: string): string {
  const clean = value.replace(/^u_/, "");
  return clean.length > 10 ? `${clean.slice(0, 8)}…` : clean;
}

async function fetchSummary(minutes: number): Promise<Summary> {
  const response = await fetch(`/api/analytics/summary?minutes=${minutes}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (response.status === 401) return { enabled: false, reason: "unauthorized" };
  if (response.status === 403) return { enabled: false, reason: "forbidden" };
  if (!response.ok) return { enabled: false, reason: "request_failed" };
  return (await response.json()) as Summary;
}

function AnalyticsPage() {
  const { data: session } = useSession();
  const [minutes, setMinutes] = useState<number>(60);

  const allowed = session?.user ? canViewAnalytics(session.user.role) : false;

  const query = useQuery({
    queryKey: ["analytics", "summary", minutes],
    queryFn: () => fetchSummary(minutes),
    enabled: allowed,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  const data = query.data;

  const chartData = useMemo(
    () =>
      (data?.timeseries ?? []).map((point) => ({
        time: formatTime(point.bucket).slice(0, 5),
        eventos: n(point.events),
        sessões: n(point.sessions),
      })),
    [data?.timeseries],
  );

  const funnelMax = Math.max(1, ...(data?.funnel ?? []).map((step) => n(step.sessions)));

  const roleMax = useMemo(
    () => Math.max(1, ...(data?.roles ?? []).map((role) => n(role.sessions))),
    [data?.roles],
  );

  if (session?.user && !allowed) {
    return (
      <>
        <PageHeader
          icon={BarChart3}
          title="Comportamento em Tempo Real"
          subtitle="Telemetria de navegação e funil de uso do portal."
        />
        <div className="mb-6 rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
          Apenas administradores, diretoria, gestores e auditores podem visualizar os dados
          comportamentais.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Comportamento em Tempo Real"
        titleClassName="font-bold"
        subtitle="Eventos anonimizados de navegação processados por Kafka → Spark → PostgreSQL. Atualiza a cada 10 segundos."
        actions={
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
            {PERIODS.map((period) => (
              <button
                key={period.minutes}
                type="button"
                onClick={() => setMinutes(period.minutes)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  minutes === period.minutes
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {period.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="ml-1 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Atualizar agora"
              title="Atualizar agora"
            >
              <RefreshCw className={cn("size-3.5", query.isFetching && "animate-spin")} />
            </button>
          </div>
        }
      />

      {data && !data.enabled ? (
        <div className="mb-6 rounded-lg border border-info/25 bg-info-soft px-4 py-3 text-sm text-info">
          <strong className="font-semibold">Pipeline analítico ainda sem dados.</strong>{" "}
          {data.reason === "analytics_schema_missing"
            ? "O esquema ainda não foi criado. Suba a stack com: docker compose -f docker-compose.analytics.yml up -d"
            : data.reason === "forbidden"
              ? "Seu papel não tem permissão para consultar as métricas."
              : "A stack Kafka/Spark/Zeppelin pode estar desligada. Verifique docs/ANALYTICS.md."}
        </div>
      ) : null}

      <section aria-label="Indicadores de comportamento" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Eventos" value={n(data?.kpis?.events).toLocaleString("pt-BR")} tone="brand" />
        <StatCard
          label="Sessões"
          value={n(data?.kpis?.sessions).toLocaleString("pt-BR")}
          tone="info"
        />
        <StatCard
          label="Usuários"
          value={n(data?.kpis?.users).toLocaleString("pt-BR")}
          tone="success"
        />
        <StatCard
          label="Tempo médio"
          value={formatDuration(n(data?.kpis?.avg_duration_ms))}
          tone="neutral"
        />
        <StatCard
          label="Scroll médio"
          value={`${Math.round(n(data?.kpis?.avg_scroll_pct))}%`}
          tone="warning"
        />
        <StatCard
          label="Rage clicks"
          value={n(data?.kpis?.rage_clicks).toLocaleString("pt-BR")}
          tone={n(data?.kpis?.rage_clicks) > 0 ? "danger" : "success"}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <PanelCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Activity className="size-4 text-brand" />
                Eventos por minuto
              </h2>
              <p className="text-xs text-muted-foreground">
                Últimos {PERIODS.find((p) => p.minutes === minutes)?.label ?? `${minutes} min`}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-success" />
              streaming
            </span>
          </div>
          <div className="mt-4 h-64 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                Aguardando os primeiros eventos…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="eventsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand, #1f7a5c)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--brand, #1f7a5c)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="eventos"
                    stroke="#1f7a5c"
                    strokeWidth={2}
                    fill="url(#eventsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <RouteIcon className="size-4 text-brand" />
            Páginas mais vistas
          </h2>
          <ul className="mt-4 space-y-3">
            {(data?.topPages ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">Sem dados no período.</li>
            ) : (
              (data?.topPages ?? []).map((page) => {
                const max = Math.max(1, ...(data?.topPages ?? []).map((p) => n(p.views)));
                return (
                  <li key={page.path}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-foreground">{page.path}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {n(page.views).toLocaleString("pt-BR")} views · {n(page.sessions)} sessões
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${Math.max(4, (n(page.views) / max) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </PanelCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-brand" />
            Sessões por papel
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Papel resolvido no servidor a partir da sessão autenticada. Eventos sem login aparecem
            como Anônimo.
          </p>
          <ul className="mt-4 space-y-3">
            {(data?.roles ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">Sem dados no período.</li>
            ) : (
              (data?.roles ?? []).map((role) => (
                <li key={role.role}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{roleName(role.role)}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {n(role.sessions)} sessões · {n(role.users)} usuários · {n(role.events)} eventos
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(4, (n(role.sessions) / roleMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </PanelCard>

        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-brand" />
            Usuários autenticados
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Identificadores pseudônimos; nomes e e-mails não são expostos.
          </p>
          {(data?.activeUsers ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum usuário autenticado no período.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Usuário</th>
                    <th className="pb-2 pr-2 font-medium">Papel</th>
                    <th className="pb-2 pr-2 font-medium">Sessões</th>
                    <th className="pb-2 pr-2 font-medium">Eventos</th>
                    <th className="pb-2 font-medium">Último evento</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.activeUsers ?? []).map((user) => (
                    <tr key={user.user_id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-2 font-mono text-foreground" title={user.user_id}>
                        {shortUserId(user.user_id)}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{roleName(user.role)}</td>
                      <td className="py-2 pr-2 text-foreground">{n(user.sessions)}</td>
                      <td className="py-2 pr-2 text-foreground">{n(user.events)}</td>
                      <td className="py-2 text-muted-foreground">{formatDateTime(user.last_seen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MousePointerClick className="size-4 text-brand" />
            Elementos mais clicados
          </h2>
          <ul className="mt-4 space-y-2.5">
            {(data?.topClicks ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">Sem cliques no período.</li>
            ) : (
              (data?.topClicks ?? []).map((click) => (
                <li
                  key={click.element}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <span className="truncate text-xs font-medium text-foreground">{click.element}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {n(click.clicks)} cliques
                    {n(click.rage_clicks) > 0 && (
                      <span className="ml-1.5 font-semibold text-danger">
                        {n(click.rage_clicks)} rage
                      </span>
                    )}
                  </span>
                </li>
              ))
            )}
          </ul>
        </PanelCard>

        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Zap className="size-4 text-brand" />
            Funil (24 h)
          </h2>
          <ul className="mt-4 space-y-3">
            {(data?.funnel ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">Sem dados de funil.</li>
            ) : (
              (data?.funnel ?? []).map((step, index) => (
                <li key={step.step}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {index + 1}. {step.step}
                    </span>
                    <span className="text-muted-foreground">{n(step.sessions)} sessões</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-info"
                      style={{ width: `${Math.max(3, (n(step.sessions) / funnelMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Sessões em que o usuário visualizou o portal, abriu, criou ou moveu uma tarefa.
          </p>
        </PanelCard>

        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-brand" />
            Últimos eventos
          </h2>
          <ul className="mt-4 space-y-2">
            {(data?.recent ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">Nenhum evento recente.</li>
            ) : (
              (data?.recent ?? []).map((event, index) => (
                <li key={`${event.event_ts}-${index}`} className="flex items-center gap-2 text-[11px]">
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 font-semibold",
                      EVENT_TONE[event.event] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {event.event}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{event.path}</span>
                  <span className="shrink-0 text-muted-foreground">{formatTime(event.event_ts)}</span>
                </li>
              ))
            )}
          </ul>
        </PanelCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-brand" />
            Sessões por minuto
          </h2>
          <div className="mt-4 h-52 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                Aguardando os primeiros eventos…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Bar dataKey="sessões" fill="#2b6cb0" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Eye className="size-4 text-brand" />
            Privacidade e governança
          </h2>
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <li>• Nenhum nome, e-mail, senha ou documento é coletado.</li>
            <li>• O IP é convertido em hash com sal e descartado.</li>
            <li>• O identificador de usuário é pseudônimo e resolvido no servidor.</li>
            <li>• O tracker respeita Do Not Track e a opção de opt-out do usuário.</li>
            <li>• Eventos brutos expiram em 30 dias; agregados, em 400 dias.</li>
          </ul>
          <p className="mt-4 rounded-lg border border-dashed border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
            A exploração analítica completa fica no Apache Zeppelin (acesso local via túnel SSH,
            porta 8090). Consulte <strong>docs/ANALYTICS.md</strong>.
          </p>
        </PanelCard>
      </div>
    </>
  );
}
