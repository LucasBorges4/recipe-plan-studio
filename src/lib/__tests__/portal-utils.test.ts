import { describe, it, expect } from "vitest";
import { parseBR, computeStatus, formatDateTime, addMonthsBR, fmtBR } from "@/lib/portal-utils";
import type { ComplianceControl } from "@/data/types";

describe("parseBR", () => {
  it("interpreta dd/mm/aaaa como data local sem fuso", () => {
    const d = parseBR("31/12/2024");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(11);
    expect(d!.getDate()).toBe(31);
  });

  it("retorna null para formato inválido", () => {
    expect(parseBR("2024-12-31")).toBeNull();
    expect(parseBR("31/13/2024")).toBeNull();
    expect(parseBR("")).toBeNull();
  });
});

describe("computeStatus", () => {
  const base: Pick<ComplianceControl, "status" | "nextReview"> = {
    status: "Conforme",
    nextReview: "01/01/2100",
  };

  it("marca 'Não conforme' quando o status é Não Conforme", () => {
    const r = computeStatus({ status: "Não Conforme", nextReview: "01/01/2100" }, new Date());
    expect(r.status).toBe("Não conforme");
    expect(r.tone).toBe("danger");
  });

  it("marca 'Conforme' para vencimento distante", () => {
    const r = computeStatus(base, parseBR("01/01/2099")!);
    expect(r.status).toBe("Conforme");
    expect(r.tone).toBe("success");
  });

  it("marca 'Vencido' para data no passado", () => {
    const r = computeStatus({ status: "Conforme", nextReview: "01/01/2000" }, new Date());
    expect(r.status).toBe("Vencido");
    expect(r.tone).toBe("danger");
    expect(r.daysLeft).toBeLessThan(0);
  });

  it("marca 'Próximo do vencimento' dentro de 30 dias", () => {
    const hoje = parseBR("01/06/2024")!;
    const em10 = parseBR("11/06/2024")!;
    const r = computeStatus({ status: "Conforme", nextReview: fmtBR(em10) }, hoje);
    expect(r.status).toBe("Próximo do vencimento");
    expect(r.tone).toBe("warning");
  });
});

describe("formatDateTime", () => {
  it("formata ISO em pt-BR sem lançar", () => {
    const s = formatDateTime("2024-08-31T12:30:00.000Z");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });
});

describe("addMonthsBR", () => {
  it("preserva o dia comum", () => {
    const r = addMonthsBR(parseBR("15/01/2024")!, 2);
    expect(fmtBR(r)).toBe("15/03/2024");
  });

  it("ajusta dia-fim para o último dia do mês destino (31/ago + 6m -> 28/fev)", () => {
    const r = addMonthsBR(parseBR("31/08/2024")!, 6);
    expect(fmtBR(r)).toBe("28/02/2025");
  });

  it("trata ano bissexto no ajuste", () => {
    const r = addMonthsBR(parseBR("31/01/2023")!, 1);
    expect(fmtBR(r)).toBe("28/02/2023");
  });

  it("soma negativa volta meses", () => {
    const r = addMonthsBR(parseBR("15/03/2024")!, -1);
    expect(fmtBR(r)).toBe("15/02/2024");
  });
});
