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
  | "admin.manage";

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
  ],
  diretor: ["task.approve", "task.comment", "evidence.review", "audit.read"],
  gestor: ["task.create", "task.move", "task.comment", "evidence.attach"],
  desenvolvedor: ["task.move", "task.comment", "evidence.attach"],
  auditor: ["audit.read"],
};

export function can(role: Role, permission: Permission) {
  return matrix[role].includes(permission);
}

export function isAdminRole(role: Role) {
  return role === "admin";
}

/** Papel atribuído a novas contas. A primeira conta do banco torna-se admin. */
export const defaultRoleForNewUser: Role = "desenvolvedor";
