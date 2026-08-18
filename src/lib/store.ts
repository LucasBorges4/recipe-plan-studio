import { useEffect, useState } from "react";
import { tasks as seedTasks } from "@/data/tasks";
import { controls as seedControls } from "@/data/compliance";
import type { ComplianceControl, Task } from "@/data/types";

/**
 * Camada de registro do portal (Fase 2/3 sem backend).
 * Persistência local por navegador, com histórico imutável de ações:
 * quem fez, quando, o que mudou. Ao ligar o Lovable Cloud, esta camada
 * é substituída pelas tabelas equivalentes sem mudar as telas.
 */

export type Role = "admin" | "diretor" | "gestor" | "desenvolvedor" | "auditor";

export interface AppUser {
  id: string;
  name: string;
  role: Role;
  jobTitle: string;
}

export const users: AppUser[] = [
  { id: "u1", name: "Vinícius Galantine", role: "admin", jobTitle: "Tech Lead" },
  { id: "u2", name: "Ana Beatriz Silva", role: "diretor", jobTitle: "Diretora de Operações" },
  { id: "u3", name: "Rafael Mendes", role: "gestor", jobTitle: "Gerente de Projetos" },
  { id: "u4", name: "Henrique Fernandes", role: "desenvolvedor", jobTitle: "Desenvolvedor Sênior" },
  { id: "u5", name: "Pedro Costa", role: "auditor", jobTitle: "Auditor Interno" },
];

export const roleLabel: Record<Role, string> = {
  admin: "Administrador",
  diretor: "Diretor",
  gestor: "Gestor",
  desenvolvedor: "Desenvolvedor",
  auditor: "Auditor",
};

type Permission =
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

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  before?: string;
  after?: string;
  reason?: string;
}

export interface Comment {
  id: string;
  taskId: string;
  author: string;
  at: string;
  body: string;
}

export interface Evidence {
  id: string;
  controlId: string;
  fileName: string;
  sentBy: string;
  at: string;
  status: "Em revisão" | "Aprovada" | "Rejeitada";
  reviewer?: string;
  reviewedAt?: string;
  note?: string;
}

export interface PortalState {
  currentUserId: string;
  tasks: Task[];
  columns: string[];
  controls: ComplianceControl[];
  comments: Comment[];
  evidences: Evidence[];
  audit: AuditEntry[];
}

const KEY = "geos-portal-v1";

function initialState(): PortalState {
  return {
    currentUserId: users[0]!.id,
    tasks: seedTasks,
    columns: ["Backlog", "A Fazer", "Em Progresso", "Em Aprovação", "Concluído"],
    controls: seedControls,
    comments: [],
    evidences: [],
    audit: [],
  };
}

let state: PortalState = initialState();
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* armazenamento indisponível */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initialState(), ...(JSON.parse(raw) as PortalState) };
  } catch {
    /* dados corrompidos: mantém a semente */
  }
  emit();
}

export function usePortal() {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    const l = () => setSnapshot({ ...state });
    listeners.add(l);
    hydrate();
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snapshot;
}

export function useCurrentUser() {
  const s = usePortal();
  return users.find((u) => u.id === s.currentUserId) ?? users[0]!;
}

function update(next: Partial<PortalState>) {
  state = { ...state, ...next };
  persist();
  emit();
}

function nowISO() {
  return new Date().toISOString();
}

function actor() {
  return users.find((u) => u.id === state.currentUserId) ?? users[0]!;
}

export function log(entry: Omit<AuditEntry, "id" | "at" | "actor" | "actorRole">) {
  const a = actor();
  const record: AuditEntry = {
    ...entry,
    id: `a${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
    at: nowISO(),
    actor: a.name,
    actorRole: a.role,
  };
  update({ audit: [record, ...state.audit] });
}

export function setCurrentUser(id: string) {
  const before = actor().name;
  state = { ...state, currentUserId: id };
  const after = actor().name;
  persist();
  log({ action: "Sessão iniciada", entity: "usuário", entityId: id, before, after });
}

/* ---------- Tarefas ---------- */

export function moveTask(id: string, column: string, reason?: string) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.column === column) return;
  update({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, column } : t)) });
  log({
    action: column === "Concluído" ? "Tarefa aprovada" : "Tarefa movida",
    entity: "tarefa",
    entityId: id,
    before: task.column,
    after: column,
    ...(reason ? { reason } : {}),
  });
}

export function createTask(task: Task) {
  update({ tasks: [task, ...state.tasks] });
  log({ action: "Tarefa criada", entity: "tarefa", entityId: task.id, after: task.title });
}

export function addColumn(name: string) {
  update({ columns: [...state.columns, name] });
  log({ action: "Coluna criada", entity: "board", entityId: name, after: name });
}

export function addComment(taskId: string, body: string) {
  const a = actor();
  const comment: Comment = {
    id: `c${Date.now()}`,
    taskId,
    author: a.name,
    at: nowISO(),
    body,
  };
  update({ comments: [...state.comments, comment] });
  log({ action: "Comentário registrado", entity: "tarefa", entityId: taskId, after: body });
}

export function taskHistory(taskId: string) {
  return state.audit.filter((a) => a.entity === "tarefa" && a.entityId === taskId);
}

/* ---------- Compliance ---------- */

export function parseBR(date: string) {
  const [d, m, y] = date.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

export type ComputedStatus = "Conforme" | "Próximo do vencimento" | "Vencido" | "Não conforme";

export function computeStatus(
  control: ComplianceControl,
  today = new Date(),
): { status: ComputedStatus; tone: "success" | "warning" | "danger"; daysLeft: number | null } {
  if (control.status === "Não Conforme")
    return { status: "Não conforme", tone: "danger", daysLeft: null };
  const next = parseBR(control.nextReview);
  if (!next) return { status: "Conforme", tone: "success", daysLeft: null };
  const daysLeft = Math.ceil((next.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft < 0) return { status: "Vencido", tone: "danger", daysLeft };
  if (daysLeft <= 30) return { status: "Próximo do vencimento", tone: "warning", daysLeft };
  return { status: "Conforme", tone: "success", daysLeft };
}

export function attachEvidence(controlId: string, fileName: string) {
  const a = actor();
  const evidence: Evidence = {
    id: `e${Date.now()}`,
    controlId,
    fileName,
    sentBy: a.name,
    at: nowISO(),
    status: "Em revisão",
  };
  update({ evidences: [evidence, ...state.evidences] });
  log({ action: "Evidência anexada", entity: "controle", entityId: controlId, after: fileName });
}

export function reviewEvidence(id: string, approved: boolean, note?: string) {
  const a = actor();
  const ev = state.evidences.find((e) => e.id === id);
  if (!ev) return;
  const status: Evidence["status"] = approved ? "Aprovada" : "Rejeitada";
  update({
    evidences: state.evidences.map((e) =>
      e.id === id
        ? { ...e, status, reviewer: a.name, reviewedAt: nowISO(), ...(note ? { note } : {}) }
        : e,
    ),
  });
  log({
    action: approved ? "Evidência aprovada" : "Evidência rejeitada",
    entity: "evidência",
    entityId: id,
    before: ev.status,
    after: status,
    ...(note ? { reason: note } : {}),
  });
}

export function reviewControl(controlId: string) {
  const control = state.controls.find((c) => c.id === controlId);
  if (!control) return;
  const today = new Date();
  const next = new Date(today.getTime());
  next.setMonth(next.getMonth() + 6);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  update({
    controls: state.controls.map((c) =>
      c.id === controlId
        ? {
            ...c,
            status: "Conforme",
            tone: "success",
            overdue: false,
            lastReview: fmt(today),
            nextReview: fmt(next),
          }
        : c,
    ),
  });
  log({
    action: "Revisão de controle registrada",
    entity: "controle",
    entityId: controlId,
    before: `${control.status} · próxima ${control.nextReview}`,
    after: `Conforme · próxima ${fmt(next)}`,
  });
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
