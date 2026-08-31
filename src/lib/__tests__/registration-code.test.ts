import { describe, it, expect, afterEach, vi } from "vitest";
import { expectedRegistrationCode } from "@/lib/portal-api";

describe("expectedRegistrationCode", () => {
  const orig = process.env["REGISTRATION_CODE"];
  const origInvite = process.env["INVITE_CODE"];
  const origCadastro = process.env["CADASTRO_CODE"];
  afterEach(() => {
    if (orig === undefined) delete process.env["REGISTRATION_CODE"];
    else process.env["REGISTRATION_CODE"] = orig;
    if (origInvite === undefined) delete process.env["INVITE_CODE"];
    else process.env["INVITE_CODE"] = origInvite;
    if (origCadastro === undefined) delete process.env["CADASTRO_CODE"];
    else process.env["CADASTRO_CODE"] = origCadastro;
    vi.restoreAllMocks();
  });
  it("retorna null quando não configurado", () => {
    delete process.env["REGISTRATION_CODE"];
    delete process.env["INVITE_CODE"];
    delete process.env["CADASTRO_CODE"];
    expect(expectedRegistrationCode()).toBeNull();
  });
  it("retorna REGISTRATION_CODE quando definido", () => {
    process.env["REGISTRATION_CODE"] = "GEOS2026";
    expect(expectedRegistrationCode()).toBe("GEOS2026");
  });
  it("usa alias INVITE_CODE", () => {
    delete process.env["REGISTRATION_CODE"];
    process.env["INVITE_CODE"] = "ABC123";
    expect(expectedRegistrationCode()).toBe("ABC123");
  });
  it("trim e ignora vazio", () => {
    process.env["REGISTRATION_CODE"] = "   ";
    expect(expectedRegistrationCode()).toBeNull();
  });
  it("trim do código", () => {
    process.env["REGISTRATION_CODE"] = "  GEOS2026  ";
    expect(expectedRegistrationCode()).toBe("GEOS2026");
  });
});
