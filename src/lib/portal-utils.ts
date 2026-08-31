import type { ComplianceControl } from "@/data/types";

/**
 * Utilidades puras de data/status do portal (sem estado, sem E/S).
 * Extraídas da antiga camada localStorage para uso cliente e servidor.
 */

export function parseBR(date: string) {
  const [d, m, y] = date.split("/").map(Number);
  if (!d || !m || !y) return null;
  const parsed = new Date(y, m - 1, d);
  // Rejeita overflow do Date (ex.: 31/13 vira janeiro do ano seguinte).
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
    return null;
  }
  return parsed;
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

export function severityTone(score: number) {
  if (score >= 15) return "danger" as const;
  if (score >= 9) return "warning" as const;
  if (score >= 4) return "info" as const;
  return "success" as const;
}

export function severityLabel(score: number) {
  if (score >= 15) return "Crítica";
  if (score >= 9) return "Alta";
  if (score >= 4) return "Moderada";
  return "Baixa";
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Formata uma data como dd/mm/aaaa (pt-BR). */
export function fmtBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Soma `months` meses a uma data, preservando o dia quando possível e
 * ajustando para o último dia do mês quando a virada ultrapassa o mês
 * destino (ex.: 31/ago + 6m → 28/fev, não 03/mar).
 */
export function addMonthsBR(d: Date, months: number): Date {
  const copy = new Date(d);
  const day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + months);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(day, lastDay));
  return copy;
}
