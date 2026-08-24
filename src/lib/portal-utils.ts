import type { ComplianceControl } from "@/data/types";

/**
 * Utilidades puras de data/status do portal (sem estado, sem E/S).
 * Extraídas da antiga camada localStorage para uso cliente e servidor.
 */

export function parseBR(date: string) {
  const [d, m, y] = date.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

export type ComputedStatus = "Conforme" | "Próximo do vencimento" | "Vencido" | "Não conforme";

export function computeStatus(
  control: Pick<ComplianceControl, "status" | "nextReview">,
  today = new Date(),
): { status: ComputedStatus; tone: "success" | "warning" | "danger"; daysLeft: number | null } {
  if (control.status === "Não Conforme")
    return { status: "Não conforme", tone: "danger", daysLeft: null };
  const next = parseBR(control.nextReview);
  if (!next) return { status: "Conforme", tone: "success", daysLeft: null };
  const daysLeft = Math.ceil((next.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft < 0) return { status: "Vencido", tone: "danger", daysLeft };
  if (daysLeft <= 30) return { status: "Próximo do vencimento", tone: "warning", daysLeft };
  return { status: "Conforme", tone: "success", daysLeft };
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
