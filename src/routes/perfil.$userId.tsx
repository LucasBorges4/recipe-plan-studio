import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { User, ArrowLeft, Mail } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { initials } from "@/components/portal/ProgressBar";
import { usePublicUser, useSession } from "@/lib/api-hooks";
import { roleLabel } from "@/lib/rbac";
import { PHOTO_ASPECT_CSS } from "@/lib/photo-frame";
import { photoForName } from "@/lib/team-photos";
import type { Role } from "@/lib/rbac";

export const Route = createFileRoute("/perfil/$userId")({
  head: () => ({
    meta: [{ title: "Perfil — Portal de Governança GWG — Grupo W. Geotec" }],
  }),
  component: PerfilPublicoPage,
});

function PerfilPublicoPage() {
  const { userId } = Route.useParams();
  const { data: userRes, isLoading } = usePublicUser(userId);
  const { data: sessionRes } = useSession();
  const me = sessionRes?.user ?? null;

  if (isLoading || !userRes) {
    return (
      <>
        <PageHeader icon={User} title="Perfil" subtitle="Carregando..." />
        <div className="animate-pulse rounded-xl border border-border bg-card p-6 h-64" />
      </>
    );
  }

  if (!userRes.ok) {
    if (userRes.error && userRes.error.includes("Faça login")) {
      return (
        <>
          <PageHeader icon={User} title="Perfil" subtitle="Perfil público" />
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {userRes.error}
          </div>
          <Link
to="/equipe"
            className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand"
          >
            <ArrowLeft className="size-3" /> Voltar
          </Link>
        </>
      );
    }
    throw notFound();
  }

  const u = userRes.data;
  const isOwn = me && me.id === u.id;

  return (
    <>
      <Link
        to="/equipe"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand"
      >
        <ArrowLeft className="size-3" /> Voltar para Equipe
      </Link>

      <PageHeader
        icon={User}
        title={u.name}
        subtitle={isOwn ? "Seu perfil público" : "Perfil público"}
        actions={
          isOwn ? (
            <Link
              to="/perfil"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:bg-brand/90"
            >
              Editar meu perfil
            </Link>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <div className="flex shrink-0 flex-col items-center">
            {u.avatarUrl || photoForName(u.name) ? (
              <img
                src={u.avatarUrl ?? photoForName(u.name)}
                alt={u.name}
                className={`h-28 rounded-lg object-cover shadow-lg ring-2 ring-brand/20 ${PHOTO_ASPECT_CSS}`}
                loading="eager"
                decoding="async"
                draggable={false}
              />
            ) : (
              <span
                className={`flex h-28 items-center justify-center rounded-lg bg-sidebar text-3xl font-semibold text-sidebar-primary-foreground shadow-lg ring-2 ring-brand/20 ${PHOTO_ASPECT_CSS}`}
              >
                {initials(u.name)}
              </span>
            )}
            <StatusBadge tone="brand" className="mt-3">
              {roleLabel[u.role]}
            </StatusBadge>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-foreground">{u.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {u.jobTitle && <span>{u.jobTitle}</span>}
              {u.department && (
                <>
                  <span>·</span>
                  <span>{u.department}</span>
                </>
              )}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-foreground">
              {u.bio || "Sem bio — edite em /perfil."}
            </p>

            <a
              href={`mailto:${u.email}`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand"
            >
              <Mail className="size-3.5" /> {u.email}
            </a>
          </div>
        </div>

        {u.functions && u.functions.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-xs font-semibold text-foreground">Funções concedidas</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {u.functions.map((f: string) => (
                <StatusBadge key={f} tone="neutral" className="text-[11px]">
                  {f}
                </StatusBadge>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
