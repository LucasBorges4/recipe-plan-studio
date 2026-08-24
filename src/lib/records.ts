import type { ComplianceControl, Module, Task } from "@/data/types";
import type { AuditableRole } from "@/lib/rbac";

/**
 * Formas de dados compartilhadas entre servidor e cliente.
 * Este módulo NÃO pode importar nada do diretório src/server.
 */

/** Registro imutável da trilha de auditoria. */
export interface AuditEntry {
  id: string;
  at: string;
  /** Nome exibido do autor ("sistema" quando não autenticado). */
  actor: string;
  actorId: string | null;
  actorRole: AuditableRole;
  action: string;
  entity: string;
  entityId: string;
  before?: string;
  after?: string;
  reason?: string;
}

export type EvidenceStatus = "Em revisão" | "Aprovada" | "Rejeitada";

export interface EvidenceRecord {
  id: string;
  controlId: string;
  fileName: string;
  sentById: string | null;
  sentByName: string;
  at: string;
  status: EvidenceStatus;
  reviewerName?: string;
  reviewedAt?: string;
  note?: string;
}

export interface CommentRecord {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string;
  at: string;
  body: string;
}

/** Estado consultável pelo cliente em uma única chamada. */
export interface PortalStatePayload {
  persistent: boolean;
  tasks: Task[];
  columns: string[];
  controls: ComplianceControl[];
  comments: CommentRecord[];
  evidences: EvidenceRecord[];
  modules: Module[];
  auditCount: number;
}
