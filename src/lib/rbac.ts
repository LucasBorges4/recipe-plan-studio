/**
 * Modelo de papéis e permissões do portal.
 * Compartilhado entre cliente (UX: esconder/mostrar ações) e servidor
 * (autoridade final: toda mutação valida a permissão novamente).
 */

export type Role = "admin" | "diretor" | "gestor" | "desenvolvedor" | "auditor";

/** Papel fictício usado apenas em registros de auditoria sem usuário autenticado. */
export type SystemRole = "sistema";
export type AuditableRole = Role | SystemRole;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  department: string | null;
  bio: string | null;
}

export interface RoleProfile {
  role: Role;
  label: string;
  position: string;
  department: string;
  functions: string[];
  permissions: Permission[];
}

/** Função associada a uma role, com chave máquina e descrição exibida. */
export interface RoleFunction {
  key: string;
  description: string;
}

/** Mapeamento de cada role para suas funções — fonte de verdade para
 *  sincronização com o banco (tabela `role_functions`). */
export const roleFunctionsData: Record<Role, RoleFunction[]> = {
  admin: [
    { key: "users.manage", description: "Gerenciar usuários, papéis e permissões do sistema" },
    { key: "modules.configure", description: "Configurar módulos, colunas do board e documentos legais" },
    { key: "compliance.approve", description: "Aprovar evidências de compliance e tarefas críticas" },
    { key: "audit.read", description: "Acessar trilha de auditoria completa do sistema" },
    { key: "automations.manage", description: "Gerenciar automações e integrações (n8n)" },
    { key: "wiki.maintain", description: "Configurar e manter a Wiki corporativa" },
    { key: "patent.stages", description: "Aprovar e gerenciar etapas de patentes" },
    { key: "security.policy", description: "Definir políticas de segurança e acesso" },
    { key: "backup.manage", description: "Gerenciar backup e restauração do banco de dados" },
  ],
  diretor: [
    { key: "tasks.approve", description: "Aprovar tarefas concluídas pelo time" },
    { key: "evidence.review", description: "Revisar e aprovar/rejeitar evidências de compliance" },
    { key: "risks.manage", description: "Gerenciar mapa de riscos e planos de mitigação" },
    { key: "patent.track", description: "Acompanhar etapas de patente junto ao INPI" },
    { key: "audit.read", description: "Consultar trilha de auditoria" },
    { key: "modules.prioritize", description: "Definir escopo e prioridades de módulos" },
    { key: "architecture.approve", description: "Aprovar alterações estratégicas de arquitetura" },
    { key: "metrics.review", description: "Revisar indicadores de aderência e vencimentos" },
  ],
  gestor: [
    { key: "tasks.manage", description: "Criar e mover tarefas no board Kanban" },
    { key: "evidence.attach", description: "Anexar evidências de compliance" },
    { key: "wiki.write", description: "Escrever e organizar artigos na Wiki corporativa" },
    { key: "journal.manage", description: "Gerenciar diário de entregas e marcos" },
    { key: "risks.manage", description: "Gerenciar riscos operacionais" },
    { key: "automations.create", description: "Criar e compartilhar automações" },
    { key: "squad.coordinate", description: "Coordenar atividades do squad" },
    { key: "modules.track", description: "Acompanhar progresso de módulos" },
    { key: "deadlines.manage", description: "Definir e revisar prazos de entregas" },
  ],
  desenvolvedor: [
    { key: "tasks.move", description: "Mover tarefas no board de desenvolvimento" },
    { key: "tasks.comment", description: "Comentar e discutir tarefas com o time" },
    { key: "evidence.attach", description: "Anexar evidências técnicas de conformidade" },
    { key: "wiki.write", description: "Escrever documentação na Wiki" },
    { key: "automations.create", description: "Criar automações de produtividade" },
    { key: "modules.implement", description: "Implementar funcionalidades dos módulos" },
    { key: "code.review", description: "Realizar code reviews e testes" },
    { key: "blockers.report", description: "Reportar bloqueios e dependências" },
  ],
  auditor: [
    { key: "audit.read", description: "Consultar trilha de auditoria completa" },
    { key: "compliance.validate", description: "Validar conformidade com LGPD, ISO 27001 e SOX" },
    { key: "evidence.review", description: "Revisar e validar evidências de compliance" },
    { key: "risks.monitor", description: "Monitorar riscos e controles de conformidade" },
    { key: "reports.generate", description: "Gerar relatórios de auditoria para a diretoria" },
    { key: "segregation.check", description: "Verificar segregação de funções em processos financeiros" },
    { key: "reviews.track", description: "Acompanhar revisões vencidas e pendências" },
    { key: "data.integrity", description: "Validar integridade dos dados e trilhas de acesso" },
  ],
};

/** Retorna as funções de uma role a partir dos dados de função. */
export function getRoleFunctions(role: Role): RoleFunction[] {
  return roleFunctionsData[role];
}

export const roles: Role[] = ["admin", "diretor", "gestor", "desenvolvedor", "auditor"];

export const roleLabel: Record<Role, string> = {
  admin: "Administrador",
  diretor: "Diretor",
  gestor: "Gestor",
  desenvolvedor: "Desenvolvedor",
  auditor: "Auditor",
};

export const auditableRoleLabel: Record<AuditableRole, string> = {
  ...roleLabel,
  sistema: "Sistema",
};

export type Permission =
  | "task.create"
  | "task.move"
  | "task.approve"
  | "task.comment"
  | "evidence.attach"
  | "evidence.review"
  | "audit.read"
  | "admin.manage"
  | "risk.manage"
  | "wiki.write"
  | "wiki.delete"
  | "journal.manage"
  | "patent.manage"
  | "automation.read"
  | "automation.create"
  | "automation.share"
  | "automation.admin"
  | "record.manage"
  | "invite.manage";

const matrix: Record<Role, Permission[]> = {
  admin: [
    "task.create",
    "task.move",
    "task.approve",
    "task.comment",
    "evidence.attach",
    "evidence.review",
    "audit.read",
    "admin.manage",
    "risk.manage",
    "wiki.write",
    "wiki.delete",
    "journal.manage",
    "patent.manage",
    "automation.read",
    "automation.create",
    "automation.share",
    "automation.admin",
    "record.manage",
    "invite.manage",
  ],
  diretor: [
    "task.approve",
    "task.comment",
    "evidence.review",
    "audit.read",
    "risk.manage",
    "wiki.write",
    "patent.manage",
    "automation.read",
    "automation.create",
    "automation.share",
    "record.manage",
  ],
  gestor: [
    "task.create",
    "task.move",
    "task.comment",
    "evidence.attach",
    "wiki.write",
    "journal.manage",
    "risk.manage",
    "automation.read",
    "automation.create",
    "automation.share",
    "record.manage",
  ],
  desenvolvedor: [
    "task.move",
    "task.comment",
    "evidence.attach",
    "wiki.write",
    "automation.read",
    "automation.create",
  ],
  auditor: ["audit.read", "automation.read"],
};

export function can(role: Role, permission: Permission) {
  return matrix[role].includes(permission);
}

export const roleProfiles: Record<Role, RoleProfile> = {
  admin: {
    role: "admin",
    label: "Administrador",
    position: "Administrador do Portal",
    department: "Governança & TI",
    functions: roleFunctionsData.admin.map((f) => f.description),
    permissions: matrix.admin,
  },
  diretor: {
    role: "diretor",
    label: "Diretor",
    position: "Diretoria Executiva",
    department: "Diretoria",
    functions: roleFunctionsData.diretor.map((f) => f.description),
    permissions: matrix.diretor,
  },
  gestor: {
    role: "gestor",
    label: "Gestor",
    position: "Gestor de Área",
    department: "Operações / Produto",
    functions: roleFunctionsData.gestor.map((f) => f.description),
    permissions: matrix.gestor,
  },
  desenvolvedor: {
    role: "desenvolvedor",
    label: "Desenvolvedor",
    position: "Engenharia",
    department: "Tecnologia",
    functions: roleFunctionsData.desenvolvedor.map((f) => f.description),
    permissions: matrix.desenvolvedor,
  },
  auditor: {
    role: "auditor",
    label: "Auditor",
    position: "Auditoria & Compliance",
    department: "Risco & Compliance",
    functions: roleFunctionsData.auditor.map((f) => f.description),
    permissions: matrix.auditor,
  },
};

/**
 * Permissão exigida para mover uma tarefa para a coluna de destino.
 * Mover para "Concluído" exige aprovação (task.approve) — nunca apenas
 * task.move — independentemente da coluna de origem, para evitar que um
 * gestor/desenvolvedor conclua uma tarefa sem a revisão obrigatória.
 */
export function movePermission(targetColumn: string): Permission {
  return targetColumn === "Concluído" ? "task.approve" : "task.move";
}

export function isAdminRole(role: Role) {
  return role === "admin";
}

/** Papel atribuído a novas contas. A primeira conta do banco torna-se admin. */
export const defaultRoleForNewUser: Role = "desenvolvedor";
