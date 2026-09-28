import type { Module, Task, Milestone, Risk } from "@/data/types";
import type { AuditEntry } from "@/lib/records";

/* ------------------------------------------------------------------ */
/* Cálculos de KPI — baseados nos dados REAIS do payload              */
/* ------------------------------------------------------------------ */

export function calculateOverallPct(modules: Module[]): number {
  const done = modules.reduce((s, m) => s + m.done, 0);
  const total = modules.reduce((s, m) => s + m.total, 0);
  return total ? Math.round((done / total) * 100) : 0;
}

export function countCompletedTasks(tasks: Task[]): number {
  return tasks.filter((t) => t.column === "Concluído").length;
}

export function countInProgressTasks(tasks: Task[], columns: string[]): number {
  const progressCols = columns.filter(
    (c) => c !== "Backlog" && c !== "Em Aprovação" && c !== "Concluído",
  );
  return tasks.filter((t) => progressCols.includes(t.column)).length;
}

export function countApprovalPendingTasks(tasks: Task[]): number {
  return tasks.filter((t) => t.column === "Em Aprovação").length;
}

export function countBacklogTasks(tasks: Task[]): number {
  return tasks.filter((t) => t.column === "Backlog").length;
}

export function getNextMilestone(
  milestones: Milestone[] | undefined,
  nextSteps: { title: string; due: string; status: string }[] | undefined,
): { title: string; due: string; status: string } | null {
  const candidates: { title: string; due: string; status: string }[] = [];
  if (milestones) {
    for (const m of milestones) {
      const due = new Date(m.date.split("/").reverse().join("-") + "T00:00:00");
      if (!isNaN(due.getTime()) && due >= new Date()) {
        candidates.push({ title: m.title, due: m.date, status: m.type });
      }
    }
  }
  if (nextSteps) {
    for (const s of nextSteps) {
      const due = new Date(s.due.split("/").reverse().join("-") + "T00:00:00");
      if (!isNaN(due.getTime()) && due >= new Date()) {
        candidates.push({ title: s.title, due: s.due, status: s.status });
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const da = new Date(a.due.split("/").reverse().join("-") + "T00:00:00");
    const db = new Date(b.due.split("/").reverse().join("-") + "T00:00:00");
    return da.getTime() - db.getTime();
  });
  const first = candidates[0];
  return first ? { title: first.title, due: first.due, status: first.status } : null;
}

export function countOpenRisks(risks: Risk[]): number {
  return risks.length; // todos os riscos no payload são considerados abertos
}

/* ------------------------------------------------------------------ */
/* Mapeamento de identidade ZAGGO                                        */
/* ------------------------------------------------------------------ */

export function mapRoleToArea(role: string): string {
  const map: Record<string, string> = {
    admin: "Governança",
    diretor: "Diretoria",
    gestor: "Gestão",
    desenvolvedor: "Engenharia",
    auditor: "Auditoria",
    visualizador: "Projeto",
  };
  return map[role] ?? "Geral";
}

export function formatNextDelivery(due: string | undefined): string {
  if (!due) return "—";
  const d = new Date(due.split("/").reverse().join("-") + "T00:00:00");
  if (isNaN(d.getTime())) return due;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

/* ------------------------------------------------------------------ */
/* Formatação de audit para UI                                          */
/* ------------------------------------------------------------------ */

export function formatAuditActor(entry: AuditEntry): string {
  return entry.actor || "Sistema";
}

export function formatAuditTime(at: string): string {
  const d = new Date(at);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.round(diffMs / 3600000);
  if (diffH < 1) return "Agora";
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.round(diffMs / 86400000);
  if (diffD === 1) return "Ontem";
  if (diffD < 7) return `${diffD} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}
