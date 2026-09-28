import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, CalendarClock, Mail } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { LeadCard } from "@/components/team/LeadCard";
import { MemberCard } from "@/components/team/MemberCard";
import { ProgressSummary } from "@/components/timeline/ProgressSummary";
import { LatestUpdates } from "@/components/timeline/LatestUpdates";
import { TimelineList } from "@/components/timeline/TimelineList";
import {
  TimelineFilters,
  DEFAULT_FILTERS,
  type TimelineFilterState,
} from "@/components/timeline/TimelineFilters";
import { usePortalData, usePublicUsers } from "@/lib/api-hooks";
import { roleLabel } from "@/lib/rbac";
import { buildTeamCatalog, normalizeNameSlug, TEAM_GROUP_LABEL } from "@/lib/team-photos";
import { timelineEvents } from "@/data/timeline";
import { filterEvents, hasActiveFilters } from "@/lib/equipe-utils";

export const Route = createFileRoute("/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe do Projeto — Portal GWG — Grupo W. Geotec" },
      {
        name: "description",
        content:
          "Conheça a equipe do Grupo W. Geotec (GWG) e acompanhe a linha do tempo do projeto: entregas, decisões, aprovações, marcos e atualizações.",
      },
      { property: "og:title", content: "Equipe do Projeto — Portal GWG — Grupo W. Geotec" },
      {
        property: "og:description",
        content: "Equipe responsável, resumo da evolução e história completa do projeto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EquipePage,
});

function EquipePage() {
  const catalog = useMemo(() => buildTeamCatalog(), []);
  const projeto = useMemo(() => catalog.filter((m) => m.group === "projeto"), [catalog]);
  const banco = useMemo(() => catalog.filter((m) => m.group === "banco"), [catalog]);
  const lead = projeto.find((m) => m.tier === "lead");
  const secondary = projeto.find((m) => m.tier === "secondary");
  const members = projeto.filter((m) => m.tier === "member");

  const { data: state } = usePortalData();
  const { data: usersRes } = usePublicUsers();
  const stack = state?.techStack ?? [];

  const projectNames = useMemo(
    () => new Set(projeto.map((m) => normalizeNameSlug(m.name))),
    [projeto],
  );

  const registeredUsers = useMemo(() => {
    const users = usersRes?.ok ? usersRes.data : [];
    return users.filter((u) => !projectNames.has(normalizeNameSlug(u.name)));
  }, [usersRes, projectNames]);

  const [filters, setFilters] = useState<TimelineFilterState>({ ...DEFAULT_FILTERS });
  const visibleEvents = useMemo(
    () => filterEvents(timelineEvents, filters),
    [timelineEvents, filters],
  );

  return (
    <>
      <PageHeader
        icon={Users}
        title="Equipe do Projeto"
        titleClassName="font-bold"
        subtitle="Conheça quem está responsável pelo desenvolvimento e acompanhamento da solução."
      />

      <section aria-label="Equipe do Projeto" className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          {lead && <LeadCard member={lead} />}
          {secondary && <LeadCard member={secondary} secondary />}
        </div>
        {members.length > 0 && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {members.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Stack Tecnológica" className="mt-12">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
          Engenharia e desenvolvimento
        </h2>
        {stack.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhuma tecnologia cadastrada.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stack.map((t) => (
              <article key={t.name} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-md bg-brand-soft text-brand">
                    <Users className="size-4" />
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

      <section aria-label={TEAM_GROUP_LABEL.banco} className="mt-12">
        <h2 className="mb-1 text-xl font-semibold tracking-tight text-foreground">
          {TEAM_GROUP_LABEL.banco}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Membros com foto no projeto: aparecem automaticamente.
        </p>
        {banco.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum perfil deste grupo ainda.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {banco.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Usuários no portal" className="mt-12">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <Users className="size-5 text-brand" />
          Usuários no portal
        </h2>
        {registeredUsers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum usuário cadastrado ainda.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {registeredUsers.map((u) => (
              <Link
                key={u.id}
                to="/perfil/$userId"
                params={{ userId: u.id }}
                className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center hover:border-brand/40 hover:shadow-md transition-colors"
              >
                {u.avatarUrl ? (
                  <img
                    src={u.avatarUrl}
                    alt={u.name}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-16 items-center justify-center rounded-lg bg-sidebar text-base font-semibold text-sidebar-primary-foreground">
                    {u.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <p className="mt-3 text-sm font-semibold text-foreground">{u.name}</p>
                <span className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-brand-soft text-brand">
                  {roleLabel[u.role] ?? u.role}
                </span>
                {u.email && (
                  <a
                    href={`mailto:${u.email}`}
                    className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-brand"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Mail className="size-3" /> {u.email}
                  </a>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Linha do tempo do projeto" className="mt-12">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <CalendarClock className="size-5 text-brand" />
          Linha do tempo do projeto
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ProgressSummary events={timelineEvents} />
          <LatestUpdates events={timelineEvents} limit={4} />
        </div>
        <div className="mt-6 space-y-4">
          <TimelineFilters events={timelineEvents} filters={filters} onChange={setFilters} />
          <TimelineList
            events={visibleEvents}
            hasActiveFilters={hasActiveFilters(filters)}
            onResetFilters={() => setFilters({ ...DEFAULT_FILTERS })}
          />
        </div>
      </section>
    </>
  );
}
