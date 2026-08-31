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
  | "automation.admin";

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
    functions: [
      "Gerenciar usuários, papéis e permissões do sistema",
      "Configurar módulos, colunas do board e documentos legais",
      "Aprovar evidências de compliance e tarefas críticas",
      "Acessar trilha de auditoria completa do sistema",
      "Gerenciar automações e integrações (n8n)",
      "Configurar e manter a Wiki corporativa",
      "Aprovar e gerenciar etapas de patentes",
      "Definir políticas de segurança e acesso",
      "Gerenciar backup e restauração do banco de dados",
    ],
    permissions: matrix.admin,
  },
  diretor: {
    role: "diretor",
    label: "Diretor",
    position: "Diretoria Executiva",
    department: "Diretoria",
    functions: [
      "Aprovar tarefas concluídas pelo time",
      "Revisar e aprovar/rejeitar evidências de compliance",
      "Gerenciar mapa de riscos e planos de mitigação",
      "Acompanhar etapas de patente junto ao INPI",
      "Consultar trilha de auditoria",
      "Definir escopo e prioridades de módulos",
      "Aprovar alterações estratégicas de arquitetura",
      "Revisar indicadores de aderência e vencimentos",
    ],
    permissions: matrix.diretor,
  },
  gestor: {
    role: "gestor",
    label: "Gestor",
    position: "Gestor de Área",
    department: "Operações / Produto",
    functions: [
      "Criar e mover tarefas no board Kanban",
      "Anexar evidências de compliance",
      "Escrever e organizar artigos na Wiki corporativa",
      "Gerenciar diário de entregas e marcos",
      "Gerenciar riscos operacionais",
      "Criar e compartilhar automações",
      "Coordenar atividades do squad",
      "Acompanhar progresso de módulos",
      "Definir e revisar prazos de entregas",
    ],
    permissions: matrix.gestor,
  },
  desenvolvedor: {
    role: "desenvolvedor",
    label: "Desenvolvedor",
    position: "Engenharia",
    department: "Tecnologia",
    functions: [
      "Mover tarefas no board de desenvolvimento",
      "Comentar e discutir tarefas com o time",
      "Anexar evidências técnicas de conformidade",
      "Escrever documentação na Wiki",
      "Criar automações de produtividade",
      "Implementar funcionalidades dos módulos",
      "Realizar code reviews e testes",
      "Reportar bloqueios e dependências",
    ],
    permissions: matrix.desenvolvedor,
  },
  auditor: {
    role: "auditor",
    label: "Auditor",
    position: "Auditoria & Compliance",
    department: "Risco & Compliance",
    functions: [
      "Consultar trilha de auditoria completa",
      "Validar conformidade com LGPD, ISO 27001 e SOX",
      "Revisar e validar evidências de compliance",
      "Monitorar riscos e controles de conformidade",
      "Gerar relatórios de auditoria para a diretoria",
      "Verificar segregação de funções em processos financeiros",
      "Acompanhar revisões vencidas e pendências",
      "Validar integridade dos dados e trilhas de acesso",
    ],
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
