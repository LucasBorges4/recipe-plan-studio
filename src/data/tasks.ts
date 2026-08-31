import type { Task } from "./types";

export const kanbanColumns = [
  "Backlog",
  "A Fazer",
  "Em Progresso",
  "Em Aprovação",
  "Concluído",
] as const;

export const tasks: Task[] = [];
