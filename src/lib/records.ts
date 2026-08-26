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
  docs: DocRecord[];
}

/**
 * Registro genérico de módulo. Os módulos de riscos, diário de bordo,
 * releases, stack, equipe, patente e wiki compartilham a mesma tabela:
 * `kind` identifica o módulo e `data` guarda os campos validados por zod
 * (src/lib/doc-schemas.ts) tanto no cliente quanto no servidor.
 */
export interface DocRecord {
  id: string;
  kind: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Convite de cadastro exposto ao administrador (nunca inclui o código em claro). */
export interface PublicInvite {
  id: string;
  email: string;
  role: string;
  hint: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  status: "Pendente" | "Utilizado" | "Expirado";
}
