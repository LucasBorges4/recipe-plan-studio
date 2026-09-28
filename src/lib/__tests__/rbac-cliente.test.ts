import { describe, it, expect } from "vitest";
import {
  roles,
  roleLabel,
  can,
  matrix,
  CLIENT_ROUTES,
  pageAllowedForRole,
  menuAllowed,
  roleHome,
} from "@/lib/rbac";

describe("rbac — cliente (REQ-012, REQ-013)", () => {
  it("roles inclui 'cliente'", () => {
    expect(roles).toContain("cliente");
  });

  it("roleLabel('cliente') é 'Cliente'", () => {
    expect(roleLabel["cliente"]).toBe("Cliente");
  });

  it("cliente só tem task.comment", () => {
    expect(can("cliente", "task.comment")).toBe(true);
    expect(can("cliente", "task.create")).toBe(false);
    expect(can("cliente", "task.move")).toBe(false);
    expect(can("cliente", "task.approve")).toBe(false);
    expect(can("cliente", "admin.manage")).toBe(false);
  });

  it("matrix admite chave 'cliente'", () => {
    expect(matrix).toHaveProperty("cliente");
    expect(matrix["cliente"]).toEqual(["task.comment"]);
  });

  it("CLIENT_ROUTES contém as rotas de cliente", () => {
    expect(CLIENT_ROUTES).toContain("/");
    expect(CLIENT_ROUTES).toContain("/perfil");
    expect(CLIENT_ROUTES).toContain("/termos");
    expect(CLIENT_ROUTES).toContain("/lgpd");
    expect(CLIENT_ROUTES).toContain("/riscos");
  });

  it("pageAllowedForRole permite apenas CLIENT_ROUTES para cliente", () => {
    expect(pageAllowedForRole("cliente", "/")).toBe(true);
    expect(pageAllowedForRole("cliente", "/perfil")).toBe(true);
    expect(pageAllowedForRole("cliente", "/termos")).toBe(true);
    expect(pageAllowedForRole("cliente", "/lgpd")).toBe(true);
    expect(pageAllowedForRole("cliente", "/tarefas")).toBe(true);
    expect(pageAllowedForRole("cliente", "/riscos")).toBe(true);
    expect(pageAllowedForRole("cliente", "/automacoes")).toBe(false);
    expect(pageAllowedForRole("cliente", "/compliance")).toBe(false);
    expect(pageAllowedForRole("cliente", "/auditoria")).toBe(false);
    expect(pageAllowedForRole("cliente", "/admin")).toBe(false);
    expect(pageAllowedForRole("cliente", "/wiki")).toBe(false);
    expect(pageAllowedForRole("cliente", "/diario")).toBe(false);
  });

  it("pageAllowedForRole retorna true para todos os outros roles", () => {
    expect(pageAllowedForRole("admin", "/tarefas")).toBe(true);
    expect(pageAllowedForRole("diretor", "/tarefas")).toBe(true);
    expect(pageAllowedForRole("gestor", "/tarefas")).toBe(true);
    expect(pageAllowedForRole("desenvolvedor", "/tarefas")).toBe(true);
    expect(pageAllowedForRole("auditor", "/tarefas")).toBe(true);
  });

  it("menuAllowed restringe cliente", () => {
    expect(menuAllowed("cliente", "/")).toBe(true);
    expect(menuAllowed("cliente", "/perfil")).toBe(true);
    expect(menuAllowed("cliente", "/tarefas")).toBe(true);
    expect(menuAllowed("cliente", "/riscos")).toBe(true);
    expect(menuAllowed("cliente", "/admin")).toBe(false);
  });

  it("menuAllowed permite tudo para roles existentes", () => {
    expect(menuAllowed("diretor", "/tarefas")).toBe(true);
    expect(menuAllowed("admin", "/admin")).toBe(true);
  });

  it("roleHome retorna '/' para cliente", () => {
    expect(roleHome("cliente")).toBe("/");
  });

  it("roleHome retorna '/' para roles existentes (não muda)", () => {
    expect(roleHome("admin")).toBe("/");
    expect(roleHome("diretor")).toBe("/");
    expect(roleHome("gestor")).toBe("/");
    expect(roleHome("desenvolvedor")).toBe("/");
    expect(roleHome("auditor")).toBe("/");
  });
});
