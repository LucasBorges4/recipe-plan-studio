import type { TeamGroup, TeamMember } from "@/data/types";
import { teamMembers } from "@/data/team";
import { teamPhotosManifest } from "./team-photos.generated";

/**
 * Catálogo consolidado da página /equipe, sincronizado entre:
 * - Equipe do Projeto: membros fixos de `src/data/team.ts` (grupo "projeto");
 * - Banco: pessoas cuja foto existe no projeto mas não estão no catálogo fixo
 *   (derivadas automaticamente do manifest de fotos — dado real, RNF13).
 * Fotos são resolvidas por `matchTeamPhoto`, que compara o nome com o manifest
 * em ordem de confiança (slug exato -> primeiro + último -> primeiro nome
 * único); ex.: "Daniel Melo" -> "/team/daniel-melo.png", "Ana Paula Soares" ->
 * "/team/ana-soares.png". Nada é inventado, apenas associado a arquivos reais:
 * quando o nome não casa de forma inequívoca, a foto simplesmente não vem e a
 * tela usa as iniciais.
 */

/** Entrada de foto considerada na sincronização por nome. */
export interface TeamPhotoEntry {
  slug: string;
  name: string;
  photo: string;
}

/** Normaliza um nome para slug determinístico (sem acentos/parenteses). */
export function normalizeNameSlug(name: string): string {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Reconstitui um nome legível a partir de um slug (ex.: "michael-barbosa"). */
export function prettyNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Tokens de um nome já normalizado, sem preposições que não identificam. */
function nameTokens(name: string): string[] {
  return normalizeNameSlug(name).split("-").filter(Boolean);
}

/**
 * Casa o nome de uma pessoa com a foto do manifest, em ordem de confiança:
 *
 *   1. slug exato — "Daniel Melo" -> `daniel-melo`
 *   2. primeiro + último — "Ana Paula Soares" -> `ana-soares`
 *
 * O cadastro do portal é livre (a pessoa digita o nome como quiser), então o
 * passo 2 é o que resolve os casos reais de nome do meio ou sobrenome a mais.
 *
 * Regra que **não** existe aqui, de propósito: casar pelo primeiro nome. Pode
 * parecer útil ("Arthur" -> `arthur`), mas o primeiro nome não identifica
 * ninguém — um cadastro chamado só "Ana" receberia a foto da "Ana Soares", e
 * isso é pior do que mostrar as iniciais. Sem casar, a tela usa as iniciais.
 */
export function matchTeamPhoto(
  name: string,
  photos: ReadonlyArray<TeamPhotoEntry> = teamPhotosManifest,
): string | undefined {
  const tokens = nameTokens(name);
  const first = tokens[0];
  if (!first) return undefined;

  const exact = photos.find((p) => p.slug === tokens.join("-"));
  if (exact) return exact.photo;

  const last = tokens.at(-1);
  if (last && last !== first) {
    const pair = photos.find((p) => p.slug === `${first}-${last}`);
    if (pair) return pair.photo;
  }

  return undefined;
}

/**
 * Foto de um nome no servidor: fallback explícito (foto enviada pelo próprio
 * usuário) tem prioridade sobre a foto do manifest.
 */
export function photoForName(name: string, fallback?: string | null): string | undefined {
  if (fallback) return fallback;
  return matchTeamPhoto(name);
}

/** Membro como exibido no catálogo: sempre com grupo resolvido e foto resolvida. */
export interface TeamCatalogMember extends TeamMember {
  group: TeamGroup;
  slug: string;
}

/** Membro do catálogo enriquecido com o vínculo (atrelagem) a uma conta real. */
export interface TeamMemberLinked extends TeamCatalogMember {
  linkedUserId: string | null;
  email: string | null;
  registered: boolean;
}

export const TEAM_GROUP_LABEL: Record<TeamGroup, string> = {
  projeto: "Equipe do Projeto",
  engenharia: "Engenharia",
};

function photoFor(member: TeamMember): string | undefined {
  if (member.photo) return member.photo;
  return matchTeamPhoto(member.name);
}

/** Catálogo completo: membros fixos + membros derivados de fotos (grupo engenharia). */
export function buildTeamCatalog(): TeamCatalogMember[] {
  const seen = new Set<string>();
  const members: TeamCatalogMember[] = [];
  for (const m of teamMembers) {
    const slug = normalizeNameSlug(m.name);
    const resolvedPhoto = photoFor(m);
    seen.add(slug);
    members.push(
      resolvedPhoto
        ? { ...m, group: m.group ?? "projeto", slug, photo: resolvedPhoto }
        : { ...m, group: m.group ?? "projeto", slug },
    );
  }
  const entries = [...teamPhotosManifest].sort((a, b) => a.slug.localeCompare(b.slug));
  for (const p of entries) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    members.push({
      id: `foto-${p.slug}`,
      name: p.name,
      role: "",
      area: "",
      group: "engenharia",
      tier: "member",
      photo: p.photo,
      channels: [],
      slug: p.slug,
    });
  }
  return members;
}

/** Junta o catálogo com os vínculos existentes nas contas (mapa memberId -> conta). */
export function buildLinkedTeamMembers(
  links: ReadonlyMap<string, { userId: string; email: string }>,
): TeamMemberLinked[] {
  return buildTeamCatalog().map((m) => {
    const link = links.get(m.id) ?? null;
    return {
      ...m,
      linkedUserId: link?.userId ?? null,
      email: link?.email ?? null,
      registered: !!link,
    };
  });
}
