import { describe, it, expect } from "vitest";
import { can, movePermission, roleLabel, defaultRoleForNewUser } from "@/lib/rbac";
import type { Role, Permission } from "@/lib/rbac";

describe("can (matriz RBAC)", () => {
  const todas: Permission[] = [
    "task.create",
    "task.move",
    "task.approve",
    "task.comment",
    "evidence.attach",
    "evidence.review",
    "audit.read",
    "admin.manage",
  ];

  it("admin tem todas as permissões", () => {
    for (const p of todas) expect(can("admin", p)).toBe(true);
  });

  it("diretor só tem aprovar/comentar/revisar/auditar", () => {
    expect(can("diretor", "task.approve")).toBe(true);
    expect(can("diretor", "evidence.review")).toBe(true);
    expect(can("diretor", "audit.read")).toBe(true);
    expect(can("diretor", "task.comment")).toBe(true);
    expect(can("diretor", "task.create")).toBe(false);
    expect(can("diretor", "task.move")).toBe(false);
    expect(can("diretor", "evidence.attach")).toBe(false);
    expect(can("diretor", "admin.manage")).toBe(false);
  });

  it("gestor pode criar/mover/comentar/anexar mas não aprovar nem admin", () => {
    expect(can("gestor", "task.create")).toBe(true);
    expect(can("gestor", "task.move")).toBe(true);
    expect(can("gestor", "task.comment")).toBe(true);
    expect(can("gestor", "evidence.attach")).toBe(true);
    expect(can("gestor", "task.approve")).toBe(false);
    expect(can("gestor", "admin.manage")).toBe(false);
  });

  it("desenvolvedor só move/comenta/anexa", () => {
    expect(can("desenvolvedor", "task.move")).toBe(true);
    expect(can("desenvolvedor", "task.comment")).toBe(true);
    expect(can("desenvolvedor", "evidence.attach")).toBe(true);
    expect(can("desenvolvedor", "task.approve")).toBe(false);
    expect(can("desenvolvedor", "task.create")).toBe(false);
  });

  it("auditor só lê auditoria", () => {
    expect(can("auditor", "audit.read")).toBe(true);
    expect(can("auditor", "task.move")).toBe(false);
    expect(can("auditor", "task.comment")).toBe(false);
  });

  it("novas contas recebem o papel padrão desenvolvedor", () => {
    expect(defaultRoleForNewUser).toBe("desenvolvedor");
  });

  it("roleLabel cobre todos os papéis", () => {
    const roles: Role[] = ["admin", "diretor", "gestor", "desenvolvedor", "auditor"];
    for (const r of roles) expect(typeof roleLabel[r]).toBe("string");
  });
});

describe("movePermission (regra de aprovação)", () => {
  it("mover para 'Concluído' exige task.approve", () => {
    expect(movePermission("Concluído")).toBe("task.approve");
  });

  it("mover para outra coluna exige apenas task.move", () => {
    expect(movePermission("Backlog")).toBe("task.move");
    expect(movePermission("Em Aprovação")).toBe("task.move");
  });

  it("desenvolvedor NÃO pode concluir direto (bypass bloqueado)", () => {
    expect(can("desenvolvedor", movePermission("Concluído"))).toBe(false);
  });

  it("diretor/gestor origem Em Aprovação ainda exigem aprovação no destino Concluído", () => {
    expect(can("gestor", movePermission("Concluído"))).toBe(false);
    expect(can("diretor", movePermission("Concluído"))).toBe(true);
  });

  it("admin sempre pode concluir", () => {
    expect(can("admin", movePermission("Concluído"))).toBe(true);
  });
});
