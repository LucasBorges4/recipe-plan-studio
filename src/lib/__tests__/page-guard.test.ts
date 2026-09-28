import { describe, it, expect } from "vitest";
import { pageAllowedForRole, menuAllowed, CLIENT_ROUTES, roleHome } from "@/lib/rbac";

describe("page-guard (AC-012 / DEC-016)", () => {
  it("cliente pode acessar apenas CLIENT_ROUTES", () => {
    for (const r of CLIENT_ROUTES) {
      expect(pageAllowedForRole("cliente", r)).toBe(true);
      expect(pageAllowedForRole("cliente", r + "/sub")).toBe(true);
    }
  });

  it("cliente NÃO pode acessar rotas fora de CLIENT_ROUTES", () => {
    const blocked = [
      "/automacoes",
      "/compliance",
      "/auditoria",
      "/admin",
      "/wiki",
      "/diario",
    ];
    for (const p of blocked) {
      expect(pageAllowedForRole("cliente", p)).toBe(false);
    }
  });

  it("admin não é afetado (todos true)", () => {
    expect(pageAllowedForRole("admin", "/tarefas")).toBe(true);
    expect(pageAllowedForRole("admin", "/admin")).toBe(true);
  });

  it("menuAllowed restringe cliente", () => {
    expect(menuAllowed("cliente", "/")).toBe(true);
    expect(menuAllowed("cliente", "/perfil")).toBe(true);
    expect(menuAllowed("cliente", "/tarefas")).toBe(true);
    expect(menuAllowed("cliente", "/riscos")).toBe(true);
    expect(menuAllowed("cliente", "/equipe")).toBe(true);
    expect(menuAllowed("cliente", "/automacoes")).toBe(false);
  });

  it("equipe é rota pública e acessível por todos os papéis", () => {
    for (const role of ["admin", "diretor", "gestor", "desenvolvedor", "auditor", "cliente", "visualizador"]) {
      expect(pageAllowedForRole(role as never, "/equipe")).toBe(true);
      expect(menuAllowed(role as never, "/equipe")).toBe(true);
    }
  });

  it("menuAllowed não restringe outros roles", () => {
    expect(menuAllowed("diretor", "/tarefas")).toBe(true);
    expect(menuAllowed("gestor", "/tarefas")).toBe(true);
    expect(menuAllowed("desenvolvedor", "/tarefas")).toBe(true);
    expect(menuAllowed("auditor", "/tarefas")).toBe(true);
  });

  it("roleHome para cliente é '/'", () => {
    expect(roleHome("cliente")).toBe("/");
  });

  it("roleHome para admin é '/' (não muda)", () => {
    expect(roleHome("admin")).toBe("/");
  });
});

describe("page-guard — visualizador (somente leitura)", () => {
  it("visualizador NÃO pode acessar /admin nem /automacoes", () => {
    expect(pageAllowedForRole("visualizador", "/admin")).toBe(false);
    expect(pageAllowedForRole("visualizador", "/admin/sub")).toBe(false);
    expect(pageAllowedForRole("visualizador", "/automacoes")).toBe(false);
    expect(pageAllowedForRole("visualizador", "/automacoes/123")).toBe(false);
  });

  it("visualizador pode acessar as demais rotas (tarefas, auditoria, wiki, riscos...)", () => {
    for (const p of ["/", "/perfil", "/termos", "/lgpd", "/tarefas", "/auditoria", "/wiki", "/riscos", "/compliance", "/diario", "/equipe"]) {
      expect(pageAllowedForRole("visualizador", p)).toBe(true);
    }
  });

  it("menuAllowed esconde /admin e /automacoes para visualizador", () => {
    expect(menuAllowed("visualizador", "/admin")).toBe(false);
    expect(menuAllowed("visualizador", "/automacoes")).toBe(false);
    expect(menuAllowed("visualizador", "/tarefas")).toBe(true);
    expect(menuAllowed("visualizador", "/auditoria")).toBe(true);
  });

  it("menuAllowed não restringe admin/diretor/gestor", () => {
    expect(menuAllowed("admin", "/admin")).toBe(true);
    expect(menuAllowed("diretor", "/automacoes")).toBe(true);
    expect(menuAllowed("gestor", "/admin")).toBe(true);
  });
});
