import { describe, it, expect } from "vitest";
import {
  buildTeamCatalog,
  buildLinkedTeamMembers,
  matchTeamPhoto,
  normalizeNameSlug,
  photoForName,
  prettyNameFromSlug,
  TEAM_GROUP_LABEL,
} from "@/lib/team-photos";
import { teamPhotosManifest } from "@/lib/team-photos.generated";

const FIXED_SLUGS = new Set([
  "gerson",
  "camila",
  "daniel-melo",
  "ana-soares",
  "tome",
  "arthur",
  "michael-barbosa",
  "lucas-borges",
]);

describe("team-photos (slug e fotos)", () => {
  it("normaliza nomes para slug determinístico", () => {
    expect(normalizeNameSlug("Michael Barbosa (Berg)")).toBe("michael-barbosa");
    expect(normalizeNameSlug("Tomé")).toBe("tome");
    expect(normalizeNameSlug("Ana Soares")).toBe("ana-soares");
    expect(normalizeNameSlug("Gérson")).toBe("gerson");
    expect(normalizeNameSlug("  João   da Silva  ")).toBe("joao-da-silva");
  });

  it("prettyNameFromSlug reconstrói o nome", () => {
    expect(prettyNameFromSlug("michael-barbosa")).toBe("Michael Barbosa");
    expect(prettyNameFromSlug("daniel-melo")).toBe("Daniel Melo");
  });

  it("photoForName usa a foto do manifest (fallback explícito tem prioridade)", () => {
    expect(photoForName("Daniel Melo")).toBe("/team/daniel-melo.png");
    expect(photoForName("Daniel Melo", "data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
    expect(photoForName("Alguém Sem Foto")).toBeUndefined();
  });
});

describe("matchTeamPhoto (sincronização de foto por nome)", () => {
  it("encontra pelo slug exato", () => {
    expect(matchTeamPhoto("Daniel Melo")).toBe("/team/daniel-melo.png");
    expect(matchTeamPhoto("  daniel   melo  ")).toBe("/team/daniel-melo.png");
  });

  it("encontra ignorando acentos e pontuação", () => {
    expect(matchTeamPhoto("Gérson")).toBe("/team/gerson.png");
    expect(matchTeamPhoto("Tomé")).toBe("/team/tome.png");
    expect(matchTeamPhoto("Michael Barbosa (Berg)")).toBe("/team/michael-barbosa.png");
  });

  it("encontra quando o cadastro tem nome do meio a mais (primeiro + último)", () => {
    // Primeiro + último: "Ana" + "Soares" casam com `ana-soares`; o "Paula" do
    // meio é descartado. É a regra que resolve cadastro com nome do meio.
    expect(matchTeamPhoto("Ana Paula Soares")).toBe("/team/ana-soares.png");
    expect(matchTeamPhoto("Lucas Ferreira Borges")).toBe("/team/lucas-borges.png");
  });

  it("NÃO casa quando o token extra é o último (apelido ou 2º sobrenome)", () => {
    // Primeiro + último dá "michael-berg" / "lucas-ferreira", que não existem
    // no manifest: a regra cobre nome do meio, não sufixo no fim do nome.
    expect(matchTeamPhoto("Michael Barbosa Berg")).toBeUndefined();
    expect(matchTeamPhoto("Lucas Borges Ferreira")).toBeUndefined();
  });

  it("prefere o par primeiro + último ao slug completo", () => {
    const withMiddle = [
      { slug: "carlos", name: "Carlos", photo: "/team/carlos.png" },
      { slug: "carlos-souza", name: "Carlos Souza", photo: "/team/carlos-souza.png" },
    ];
    expect(matchTeamPhoto("Carlos Souza", withMiddle)).toBe("/team/carlos-souza.png");
  });

  it("NÃO casa pelo primeiro nome: só o primeiro nome não identifica ninguém", () => {
    // Um cadastro chamado "Ana" não pode herdar a foto da "Ana Soares": pior
    // que mostrar as iniciais é mostrar a pessoa errada.
    const unique = [{ slug: "ana-soares", name: "Ana Soares", photo: "/team/ana-soares.png" }];
    expect(matchTeamPhoto("Ana", unique)).toBeUndefined();
    expect(matchTeamPhoto("Arthur", unique)).toBeUndefined();
  });

  it("NÃO casa quando o par primeiro + último não existe", () => {
    const ambiguous = [
      { slug: "carlos-silva", name: "Carlos Silva", photo: "/team/carlos-silva.png" },
      { slug: "carlos-souza", name: "Carlos Souza", photo: "/team/carlos-souza.png" },
    ];
    expect(matchTeamPhoto("Carlos Pereira", ambiguous)).toBeUndefined();
    expect(matchTeamPhoto("Carlos Souza", ambiguous)).toBe("/team/carlos-souza.png");
  });

  it("ignora o par quando o nome tem um único token", () => {
    const withMiddle = [
      { slug: "carlos", name: "Carlos", photo: "/team/carlos.png" },
      { slug: "carlos-souza", name: "Carlos Souza", photo: "/team/carlos-souza.png" },
    ];
    // Nome de um token só: casa pelo slug exato ou não casa.
    expect(matchTeamPhoto("Carlos", withMiddle)).toBe("/team/carlos.png");
    expect(matchTeamPhoto("Carla", withMiddle)).toBeUndefined();
  });

  it("resolve as fotos de todos os membros do catálogo", () => {
    for (const member of buildTeamCatalog()) {
      expect(matchTeamPhoto(member.name), `sem foto para ${member.name}`).toBeTruthy();
    }
  });
});

describe("buildTeamCatalog (catálogo sincronizado)", () => {
  it("mantém a equipe fixa do projeto no grupo projeto", () => {
    const catalog = buildTeamCatalog();
    const gerson = catalog.find((m) => m.id === "gerson");
    expect(gerson?.group).toBe("projeto");
    expect(gerson?.tier).toBe("lead");
    const camila = catalog.find((m) => m.id === "camila");
    expect(camila?.group).toBe("projeto");
    expect(camila?.primaryContact).toBe(true);
  });

  it("todos os membros têm id único e grupo resolvido", () => {
    const catalog = buildTeamCatalog();
    const ids = catalog.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of catalog) expect(TEAM_GROUP_LABEL[m.group]).toBeTruthy();
  });

  it("grupo engenharia deriva de fotos não correspondidas a membros fixos", () => {
    const catalog = buildTeamCatalog();
    const engenharia = catalog.filter((m) => m.group === "engenharia");
    const manifestOnly = teamPhotosManifest.filter((p) => !FIXED_SLUGS.has(p.slug));
    expect(engenharia.length).toBe(manifestOnly.length);
    for (const e of engenharia) {
      expect(e.photo).toBeTruthy();
      expect(manifestOnly.some((p) => p.photo === e.photo)).toBe(true);
    }
  });

  it("foto do Daniel é resolvida pelo manifest", () => {
    const daniel = buildTeamCatalog().find((m) => m.id === "daniel-melo");
    expect(daniel?.photo).toBe("/team/daniel-melo.png");
  });
});

describe("buildLinkedTeamMembers (atrelagem)", () => {
  it("marca registered/linkedUserId/email apenas para quem atrelou", () => {
    const links = new Map([
      ["daniel-melo", { userId: "u1", email: "contato.danielmoura@gmail.com" }],
    ]);
    const list = buildLinkedTeamMembers(links);
    const daniel = list.find((m) => m.id === "daniel-melo");
    expect(daniel?.registered).toBe(true);
    expect(daniel?.linkedUserId).toBe("u1");
    expect(daniel?.email).toBe("contato.danielmoura@gmail.com");
    const gerson = list.find((m) => m.id === "gerson");
    expect(gerson?.registered).toBe(false);
    expect(gerson?.linkedUserId).toBeNull();
  });
});
