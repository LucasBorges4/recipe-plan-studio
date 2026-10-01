import { describe, it, expect } from "vitest";
import { teamMembers } from "@/data/team";

describe("team data (Equipe e Projeto)", () => {
  it("contém Gérson (lead) e Camila (secondary, contato principal)", () => {
    const ger = teamMembers.find((m) => m.id === "gerson");
    const cam = teamMembers.find((m) => m.id === "camila");
    expect(ger?.tier).toBe("lead");
    expect(cam?.tier).toBe("secondary");
    expect(cam?.primaryContact).toBe(true);
    expect(ger?.role).toBe("Presidente Científico e Estratégico");
    expect(cam?.role).toBe("Diretora Executiva Geral");
  });

  it("todos os cargos definidos estão em português (RF03)", () => {
    for (const m of teamMembers) {
      if (m.role) {
        expect(m.role).toMatch(/^[\w\sáéíóúâêôãõçàèìòùäëïöüñÁÉÍÓÚÂÊÔÃÕÇÀÈÌÒÙÄËÏÖÜÑ\s.,-]+$/);
      }
    }
  });

  it("contém os envolvidos solicitados: Daniel, Ana, Tomé, Arthur, Michael", () => {
    const ids = teamMembers.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "daniel-melo",
        "ana-soares",
        "tome",
        "arthur",
        "michael-barbosa",
      ]),
    );
    const names = teamMembers.map((m) => m.name.toLowerCase());
    expect(names.some((n) => n.includes("ana soares"))).toBe(true);
    expect(names.some((n) => n.includes("tome") || n.includes("tomé"))).toBe(true);
    expect(names.some((n) => n.includes("arthur"))).toBe(true);
    expect(names.some((n) => n.includes("michael"))).toBe(true);
  });

  it("Daniel Melo tem foto salva no asset público", () => {
    const daniel = teamMembers.find((m) => m.id === "daniel-melo");
    expect(daniel?.photo).toBe("/team/daniel-melo.png");
  });

  it("nenhum membro possui canais de contato falsos (RNF07)", () => {
    for (const m of teamMembers) expect(m.channels).toHaveLength(0);
  });
});