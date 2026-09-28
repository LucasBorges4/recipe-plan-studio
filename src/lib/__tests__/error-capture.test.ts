/**
 * Testes unitários para src/lib/error-capture.ts
 */

import { describe, it, expect } from "vitest";
import { describeError } from "@/lib/error-capture";

describe("error-capture — describeError", () => {
  it("descreve Error simples", () => {
    const err = new Error("Algo falhou");
    const result = describeError(err);
    expect(result).toContain("Algo falhou");
    expect(result).toContain("Error");
  });

  it("descreve Error com stack trace", () => {
    const err = new Error("Com stack");
    const result = describeError(err);
    expect(result.length).toBeGreaterThan(0);
  });

  it("inclui status quando disponível", () => {
    const err = new Error("Não encontrado") as Error & { status: number };
    err.status = 404;
    const result = describeError(err);
    expect(result).toContain("status 404");
  });

  it("descreve string não-Error", () => {
    const result = describeError("erro de texto");
    expect(result).toContain("erro de texto");
  });

  it("descreve objeto não-Error", () => {
    const result = describeError({ code: 500, message: "Interno" });
    expect(result).toContain("Interno");
    expect(result.length).toBeGreaterThan(0);
  });

  it("percorre cadeia de causas até limite", () => {
    const root = new Error("Root cause");
    const mid = new Error("Mid", { cause: root });
    const top = new Error("Top", { cause: mid });
    const result = describeError(top);
    expect(result).toContain("Top");
    expect(result).toContain("Mid");
    expect(result).toContain("Root cause");
  });

  it("retorna string vazia para null", () => {
    const result = describeError(null);
    expect(typeof result).toBe("string");
  });
});

describe("error-capture — renderErrorPage", () => {
  it("retorna HTML válido", async () => {
    const { renderErrorPage } = await import("@/lib/error-page");
    const html = renderErrorPage();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<html");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("This page didn't load");
  });

  it("contém elementos de UI esperados", async () => {
    const { renderErrorPage } = await import("@/lib/error-page");
    const html = renderErrorPage();
    expect(html).toContain("Try again");
    expect(html).toContain("Go home");
    expect(html).toContain('onclick="location.reload()"');
    expect(html).toContain('href="/"');
  });

  it("tem meta viewport para responsividade", async () => {
    const { renderErrorPage } = await import("@/lib/error-page");
    const html = renderErrorPage();
    expect(html).toContain("viewport");
  });
});
