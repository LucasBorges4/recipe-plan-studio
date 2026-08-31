import { describe, it, expect } from "vitest";
import { parseBR, computeStatus, addMonthsBR, fmtBR } from "@/lib/portal-utils";

describe("portal-utils estendido", () => {
  it("parseBR rejeita datas inválidas", () => {
    expect(parseBR("31/02/2026")).toBeNull();
    expect(parseBR("99/99/9999")).toBeNull();
    expect(parseBR("10/10/2026")?.getDate()).toBe(10);
  });
  it("computeStatus vencido e próximo do vencimento", () => {
    const today = new Date(2026, 1, 15);
    const vencido = computeStatus({ status: "Conforme", nextReview: "01/01/2026" }, today);
    expect(vencido.status).toBe("Vencido");
    const proximo = computeStatus({ status: "Conforme", nextReview: "10/03/2026" }, today);
    expect(proximo.status).toBe("Próximo do vencimento");
  });
  it("addMonthsBR lida com fim de mês", () => {
    const d = new Date(2026, 7, 31);
    const nxt = addMonthsBR(d, 6);
    expect(fmtBR(nxt)).toBe("28/02/2027");
  });
  it("Não conforme sempre danger", () => {
    expect(computeStatus({ status: "Não Conforme", nextReview: "01/01/2030" }).tone).toBe("danger");
  });
});
