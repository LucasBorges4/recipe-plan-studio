import { describe, it, expect } from "vitest";
import { can, roleProfiles, roles, roleLabel } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";

describe("roleProfiles", () => {
  it("cobre todos os roles", () => {
    for (const r of roles) expect(roleProfiles[r].role).toBe(r);
  });
  it("cada perfil tem funções e permissões coerentes com can", () => {
    for (const r of roles as Role[]) {
      const p = roleProfiles[r];
      expect(p.label).toBe(roleLabel[r]);
      expect(p.functions.length).toBeGreaterThan(0);
      for (const perm of p.permissions) expect(can(r, perm)).toBe(true);
    }
  });
  it("admin tem todas as novas permissões", () => {
    expect(can("admin", "risk.manage")).toBe(true);
    expect(can("admin", "wiki.write")).toBe(true);
    expect(can("admin", "wiki.delete")).toBe(true);
    expect(can("admin", "journal.manage")).toBe(true);
    expect(can("admin", "patent.manage")).toBe(true);
  });
  it("auditor não tem permissões de escrita", () => {
    expect(can("auditor", "risk.manage")).toBe(false);
    expect(can("auditor", "wiki.write")).toBe(false);
    expect(can("auditor", "patent.manage")).toBe(false);
  });
  it("gestor e desenvolvedor têm wiki.write", () => {
    expect(can("gestor", "wiki.write")).toBe(true);
    expect(can("desenvolvedor", "wiki.write")).toBe(true);
    expect(can("desenvolvedor", "wiki.delete")).toBe(false);
  });
});
