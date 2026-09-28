import { describe, it, expect } from "vitest";
import {
  CLIENT_STAGES,
  stageLabel,
  stageTone,
  columnToStage,
  stageToColumn,
  inferProgressFromStage,
  isWaitingOnClient,
} from "@/lib/task-stages";
import type { Stage } from "@/lib/task-stages";

describe("task-stages", () => {
  it("CLIENT_STAGES contém as 5 etapas", () => {
    expect(CLIENT_STAGES).toHaveLength(5);
    expect(CLIENT_STAGES).toContain("not_started");
    expect(CLIENT_STAGES).toContain("in_progress");
    expect(CLIENT_STAGES).toContain("waiting_client");
    expect(CLIENT_STAGES).toContain("review");
    expect(CLIENT_STAGES).toContain("done");
  });

  it("stageLabel retorna rótulos em PT-BR", () => {
    expect(stageLabel("not_started")).toBe("Não iniciada");
    expect(stageLabel("in_progress")).toBe("Em andamento");
    expect(stageLabel("waiting_client")).toBe("Aguardando você");
    expect(stageLabel("review")).toBe("Em revisão");
    expect(stageLabel("done")).toBe("Concluída");
  });

  it("stageTone retorna mapeamento correto", () => {
    expect(stageTone("not_started")).toBe("neutral");
    expect(stageTone("in_progress")).toBe("info");
    expect(stageTone("waiting_client")).toBe("warning");
    expect(stageTone("review")).toBe("brand");
    expect(stageTone("done")).toBe("success");
  });

  it("columnToStage mapeia todas as colunas internas", () => {
    expect(columnToStage("Backlog")).toBe("not_started");
    expect(columnToStage("A Fazer")).toBe("not_started");
    expect(columnToStage("Em Progresso")).toBe("in_progress");
    expect(columnToStage("Em Execução")).toBe("in_progress");
    expect(columnToStage("Aguardando você")).toBe("waiting_client");
    expect(columnToStage("Em Aprovação")).toBe("review");
    expect(columnToStage("Em Revisão")).toBe("review");
    expect(columnToStage("Concluído")).toBe("done");
  });

  it("columnToStage usa fallback para coluna desconhecida", () => {
    expect(columnToStage("Coluna Fantasma")).toBe("not_started");
    expect(columnToStage("")).toBe("not_started");
  });

  it("stageToColumn é idempotente com columnToStage", () => {
    const stages: Stage[] = ["not_started", "in_progress", "waiting_client", "review", "done"];
    for (const s of stages) {
      expect(columnToStage(stageToColumn(s))).toBe(s);
    }
  });

  it("inferProgressFromStage retorna progresso correto", () => {
    expect(inferProgressFromStage("not_started")).toBe(0);
    expect(inferProgressFromStage("in_progress")).toBe(50);
    expect(inferProgressFromStage("waiting_client")).toBe(60);
    expect(inferProgressFromStage("review")).toBe(80);
    expect(inferProgressFromStage("done")).toBe(100);
  });

  it("isWaitingOnClient é verdadeiro apenas para waiting_client", () => {
    expect(isWaitingOnClient("waiting_client")).toBe(true);
    expect(isWaitingOnClient("not_started")).toBe(false);
    expect(isWaitingOnClient("in_progress")).toBe(false);
    expect(isWaitingOnClient("review")).toBe(false);
    expect(isWaitingOnClient("done")).toBe(false);
  });
});
