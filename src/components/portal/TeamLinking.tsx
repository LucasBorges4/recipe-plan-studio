import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Link as LinkIcon, Search, Unlink } from "lucide-react";
import { toast } from "sonner";
import { useTeamMembers, useLinkTeamProfile, useUnlinkTeamProfile } from "@/lib/api-hooks";
import { qk } from "@/lib/api-hooks";
import { updateProfileFn } from "@/lib/portal-api";
import { normalizeNameSlug, TEAM_GROUP_LABEL, type TeamMemberLinked } from "@/lib/team-photos";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Avatar } from "@/components/portal/Avatar";
import { initials } from "@/components/portal/ProgressBar";
import { PHOTO_ASPECT_CSS } from "@/lib/photo-frame";

interface TeamLinkingProps {
  userId: string | null | undefined;
  teamMemberId: string | undefined;
}

export function TeamLinking({ userId, teamMemberId }: TeamLinkingProps) {
  const qc = useQueryClient();
  const { data: teamRes } = useTeamMembers();
  const teamCatalog: TeamMemberLinked[] = teamRes?.ok ? teamRes.data : [];
  const linkedMember = useMemo(
    () => teamCatalog.find((m) => m.id === teamMemberId) ?? null,
    [teamCatalog, teamMemberId],
  );
  const linkM = useLinkTeamProfile();
  const unlinkM = useUnlinkTeamProfile();
  const [teamSearch, setTeamSearch] = useState("");

  const candidates = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return teamCatalog.filter(
      (m) => m.linkedUserId == null || m.linkedUserId === userId,
    ).filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        normalizeNameSlug(m.name).includes(normalizeNameSlug(q)) ||
        `${m.role} ${m.area}`.toLowerCase().includes(q),
    );
  }, [teamCatalog, teamSearch, userId]);

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <LinkIcon className="size-4 text-brand" />
        Atrelagem à equipe
      </h2>
      {linkedMember ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {linkedMember.photo ? (
              <img
                src={linkedMember.photo}
                alt={`Foto de ${linkedMember.name}`}
                className={`h-14 rounded-lg object-cover ring-2 ring-brand/20 ${PHOTO_ASPECT_CSS}`}
              />
            ) : (
              <span
                className={`flex h-14 items-center justify-center rounded-lg bg-sidebar text-base font-semibold text-sidebar-primary-foreground ring-2 ring-brand/20 ${PHOTO_ASPECT_CSS}`}
              >
                {initials(linkedMember.name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{linkedMember.name}</p>
              <p className="text-xs text-muted-foreground">{linkedMember.role || "Papel a definir"}</p>
              <StatusBadge tone="brand" className="mt-1">
                {TEAM_GROUP_LABEL[linkedMember.group]}
              </StatusBadge>
            </div>
          </div>
          <button
            type="button"
            disabled={unlinkM.isPending}
            onClick={() => unlinkM.mutate()}
            className="flex items-center justify-center gap-2 rounded-md bg-danger px-4 py-2 text-xs font-medium text-white hover:bg-danger/90 disabled:opacity-50"
          >
            <Unlink className="size-4" />
            {unlinkM.isPending ? "Desatrelando..." : "Desatrelar do login"}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Busque seu nome (ou o de um membro) no catálogo da equipe e atrele ao seu login: o
            perfil fica pronto com foto e cargo para sincronizar com o cadastro.
          </p>
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              placeholder="Buscar pelo nome (ex.: Daniel Melo)"
              className="w-full rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm"
            />
          </div>
          {candidates.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border bg-surface p-5 text-center text-xs text-muted-foreground">
              Nenhum perfil encontrado com esse nome.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {candidates.slice(0, 12).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {m.photo ? (
                      <img
                        src={m.photo}
                        alt={`Foto de ${m.name}`}
                        className={`h-10 shrink-0 rounded-lg object-cover ${PHOTO_ASPECT_CSS}`}
                      />
                    ) : (
                      <span
                        className={`flex h-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-xs font-semibold text-sidebar-primary-foreground ${PHOTO_ASPECT_CSS}`}
                      >
                        {initials(m.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{m.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {m.role || "Papel a definir"} · {TEAM_GROUP_LABEL[m.group]}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={linkM.isPending}
                    onClick={() => linkM.mutate(m.id)}
                    className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                  >
                    Atrelar
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
