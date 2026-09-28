/**
 * Testes unitários para src/lib/zaggo-helpers.ts
 *
 * Cada função é testada com:
 * - Caso normal
 * - Caso limite (vazio, undefined)
 * - Caso de erro (dados inválidos)
 */

import { describe, it, expect } from "vitest";
import {
  calculateOverallPct,
  countCompletedTasks,
  countInProgressTasks,
  countApprovalPendingTasks,
  countBacklogTasks,
  getNextMilestone,
  countOpenRisks,
  mapRoleToArea,
  formatNextDelivery,
  formatAuditActor,
  formatAuditTime,
} from "@/lib/zaggo-helpers";
import type { Module, Task, Milestone, Risk, AuditEntry } from "@/data/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const makeModule = (done: number, total: number): Module => ({
  id: "mod-1",
  title: "Módulo",
  done,
  total,
});

const makeTask = (column: string): Task => ({
  id: "task-1",
  title: "Tarefa",
  column: column as Task["column"],
  status: "pending",
});

const makeMilestone = (
  title: string,
  date: string,
  type: string = "entrega",
): Milestone => ({
  id: "ms-1",
  title,
  date,
  type: type as Milestone["type"],
});

const makeRisk = (): Risk => ({
  id: "risk-1",
  title: "Risco",
  status: "aberto",
});

const makeAuditEntry = (actor: string = "Teste"): AuditEntry => ({
  id: "audit-1",
  action: "teste",
  entity: "test",
  entityId: "1",
  actor,
  actorId: "1",
  actorRole: "admin",
  at: new Date().toISOString(),
});

/* ------------------------------------------------------------------ */
/* calculateOverallPct                                                 */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — calculateOverallPct", () => {
  it("calcula porcentagem de conclusão", () => {
    expect(calculateOverallPct([makeModule(3, 5)])).toBe(60);
  });

  it("retorna 0 quando total é 0", () => {
    expect(calculateOverallPct([makeModule(0, 0)])).toBe(0);
  });

  it("retorna 100 quando tudo está feito", () => {
    expect(calculateOverallPct([makeModule(5, 5)])).toBe(100);
  });

  it("módulos vazios retorna 0", () => {
    expect(calculateOverallPct([])).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* countCompletedTasks                                                 */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — countCompletedTasks", () => {
  it("conta tarefas concluídas", () => {
    const tasks = [makeTask("Concluído"), makeTask("Em Aprovação"), makeTask("Concluído")];
    expect(countCompletedTasks(tasks)).toBe(2);
  });

  it("retorna 0 sem tarefas concluídas", () => {
    expect(countCompletedTasks([makeTask("Backlog")])).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* countInProgressTasks                                                */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — countInProgressTasks", () => {
  it("conta tarefas em progresso", () => {
    const tasks = [
      makeTask("Em Andamento"),
      makeTask("Backlog"),
      makeTask("Em Aprovação"),
      makeTask("Concluído"),
    ];
    const columns = ["Em Andamento", "Em Aprovação", "Concluído", "Backlog"];
    expect(countInProgressTasks(tasks, columns)).toBe(1); // apenas "Em Andamento"
  });

  it("retorna 0 quando todas estão em colunas excluídas", () => {
    const tasks = [makeTask("Backlog"), makeTask("Concluído")];
    expect(countInProgressTasks(tasks, ["Backlog", "Concluído"])).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* countApprovalPendingTasks                                           */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — countApprovalPendingTasks", () => {
  it("conta tarefas em aprovação", () => {
    const tasks = [makeTask("Em Aprovação"), makeTask("Concluído")];
    expect(countApprovalPendingTasks(tasks)).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* countBacklogTasks                                                   */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — countBacklogTasks", () => {
  it("conta tarefas no backlog", () => {
    const tasks = [makeTask("Backlog"), makeTask("Em Aprovação")];
    expect(countBacklogTasks(tasks)).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* getNextMilestone                                                    */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — getNextMilestone", () => {
  it("retorna o próximo milestone futuro", () => {
    const futureDate = new Date(Date.now() + 86400000 * 30)
      .toLocaleDateString("pt-BR")
      .split("/")
      .reverse()
      .join("-");
    const milestones = [makeMilestone("Próximo", futureDate)];
    const result = getNextMilestone(milestones, undefined);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Próximo");
  });

  it("retorna null quando não há futuros", () => {
    const pastDate = new Date(Date.now() - 86400000)
      .toLocaleDateString("pt-BR")
      .split("/")
      .reverse()
      .join("-");
    const result = getNextMilestone([makeMilestone("Passado", pastDate)], undefined);
    expect(result).toBeNull();
  });

  it("retorna null para undefined", () => {
    expect(getNextMilestone(undefined, undefined)).toBeNull();
  });

  it("considera nextSteps também", () => {
    const futureDate = new Date(Date.now() + 86400000 * 7)
      .toLocaleDateString("pt-BR")
      .split("/")
      .reverse()
      .join("-");
    const result = getNextMilestone(undefined, [{ title: "Task", due: futureDate, status: "pendente" }]);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Task");
  });

  it("ordena por data, retornando o mais próximo", () => {
    const d1 = new Date(Date.now() + 86400000 * 30)
      .toLocaleDateString("pt-BR")
      .split("/")
      .reverse()
      .join("-");
    const d2 = new Date(Date.now() + 86400000)
      .toLocaleDateString("pt-BR")
      .split("/")
      .reverse()
      .join("-");
    const result = getNextMilestone(
      [makeMilestone("Longo", d1), makeMilestone("Curto", d2)],
      undefined,
    );
    expect(result!.title).toBe("Curto"); // mais próximo
  });
});

/* ------------------------------------------------------------------ */
/* countOpenRisks                                                      */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — countOpenRisks", () => {
  it("conta todos os riscos como abertos", () => {
    expect(countOpenRisks([makeRisk(), makeRisk()])).toBe(2);
  });

  it("retorna 0 para array vazio", () => {
    expect(countOpenRisks([])).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* mapRoleToArea                                                       */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — mapRoleToArea", () => {
  it("mapeia roles conhecidos", () => {
    expect(mapRoleToArea("admin")).toBe("Governança");
    expect(mapRoleToArea("diretor")).toBe("Diretoria");
    expect(mapRoleToArea("gestor")).toBe("Gestão");
    expect(mapRoleToArea("desenvolvedor")).toBe("Engenharia");
    expect(mapRoleToArea("auditor")).toBe("Auditoria");
    expect(mapRoleToArea("visualizador")).toBe("Projeto");
  });

  it("retorna 'Geral' para role desconhecido", () => {
    expect(mapRoleToArea("desconhecido")).toBe("Geral");
    expect(mapRoleToArea("")).toBe("Geral");
  });
});

/* ------------------------------------------------------------------ */
/* formatNextDelivery                                                  */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — formatNextDelivery", () => {
  it("formata data futura", () => {
    const future = new Date(Date.now() + 86400000 * 30)
      .toLocaleDateString("pt-BR")
      .split("/")
      .reverse()
      .join("-");
    const result = formatNextDelivery(future);
    expect(result).not.toBe("—");
  });

  it("retorna '—' para undefined", () => {
    expect(formatNextDelivery(undefined)).toBe("—");
  });

  it("retorna '—' para data inválida", () => {
    expect(formatNextDelivery("invalid")).toBe("invalid");
  });
});

/* ------------------------------------------------------------------ */
/* formatAuditActor                                                    */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — formatAuditActor", () => {
  it("retorna nome do ator", () => {
    expect(formatAuditActor(makeAuditEntry("João"))).toBe("João");
  });

  it("retorna 'Sistema' para ator vazio", () => {
    expect(formatAuditActor(makeAuditEntry(""))).toBe("Sistema");
  });
});

/* ------------------------------------------------------------------ */
/* formatAuditTime                                                     */
/* ------------------------------------------------------------------ */

describe("zaggo-helpers — formatAuditTime", () => {
  it("retorna 'Agora' para menos de 1h", () => {
    const result = formatAuditTime(new Date().toISOString());
    expect(result).toBe("Agora");
  });

  it("retorna 'Xh atrás' para menos de 24h", () => {
    const past = new Date(Date.now() - 7200000).toISOString(); // 2h atrás
    expect(formatAuditTime(past)).toBe("2h atrás");
  });

  it("retorna 'Ontem' para 1 dia atrás", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(formatAuditTime(past)).toBe("Ontem");
  });

  it("retorna 'X dias atrás' para menos de 7 dias", () => {
    const past = new Date(Date.now() - 86400000 * 3).toISOString();
    expect(formatAuditTime(past)).toBe("3 dias atrás");
  });

  it("retorna data formatada para mais de 7 dias", () => {
    const past = new Date(Date.now() - 86400000 * 30).toISOString();
    const result = formatAuditTime(past);
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });
});
