import type { StatusTone, Stage } from "@/data/types";
export type { Stage } from "@/data/types";

export const CLIENT_STAGES: readonly Stage[] = [
  "not_started",
  "in_progress",
  "waiting_client",
  "review",
  "done",
] as const;

export function stageLabel(stage: Stage): string {
  switch (stage) {
    case "not_started":
      return "Não iniciada";
    case "in_progress":
      return "Em andamento";
    case "waiting_client":
      return "Aguardando você";
    case "review":
      return "Em revisão";
    case "done":
      return "Concluída";
  }
}

export function stageTone(stage: Stage): StatusTone {
  switch (stage) {
    case "not_started":
      return "neutral";
    case "in_progress":
      return "info";
    case "waiting_client":
      return "warning";
    case "review":
      return "brand";
    case "done":
      return "success";
  }
}

export function columnToStage(column: string): Stage {
  const normalized = column.trim();
  if (["Backlog", "A Fazer"].includes(normalized)) return "not_started";
  if (["Em Progresso", "Em Execução"].includes(normalized)) return "in_progress";
  if (normalized === "Aguardando você") return "waiting_client";
  if (["Em Aprovação", "Em Revisão"].includes(normalized)) return "review";
  if (normalized === "Concluído") return "done";
  return "not_started";
}

export function stageToColumn(stage: Stage): string {
  switch (stage) {
    case "not_started":
      return "A Fazer";
    case "in_progress":
      return "Em Progresso";
    case "waiting_client":
      return "Aguardando você";
    case "review":
      return "Em Revisão";
    case "done":
      return "Concluído";
  }
}

export function inferProgressFromStage(stage: Stage): number {
  switch (stage) {
    case "not_started":
      return 0;
    case "in_progress":
      return 50;
    case "waiting_client":
      return 60;
    case "review":
      return 80;
    case "done":
      return 100;
  }
}

export function isWaitingOnClient(stage: Stage): boolean {
  return stage === "waiting_client";
}
