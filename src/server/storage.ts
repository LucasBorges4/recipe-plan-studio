import type {
  ComplianceControl,
  Milestone,
  Module,
  PatentStage,
  Priority,
  Release,
  Risk,
  Task,
  TechItem,
  WikiArticle,
} from "@/data/types";
import type {
  AuditEntry,
  CommentRecord,
  DocRecord,
  EvidenceRecord,
  JsonObject,
} from "@/lib/records";
import type { Role, RoleFunction } from "@/lib/rbac";

/**
 * Camada de persistência do portal.
 *
 * Driver principal: SQLite embutido via `node:sqlite` (sem dependências
 * nativas), em arquivo apontado por DATABASE_PATH (padrão .data/portal.db).
 * Fallback: driver em memória — usado quando o módulo ou o sistema de
 * arquivos não está disponível (ex.: runtime edge da Lovable). Nesse modo
 * todas as funções operam normalmente, mas os dados vivem apenas durante a
 * instância; mutações seguem funcionando e a interface sinaliza o modo.
 *
 * Toda a lógica de negócio fala apenas com a interface `Storage`; migrar
 * para Postgres/Lovable Cloud significa implementar `Storage` novamente.
 *
 * Formas compartilhadas com o cliente (comentários, evidências, auditoria,
 * payload do estado) vivem em src/lib/records.ts — este arquivo não deve
 * exportar tipos usados por componentes client.
 */

export type { AuditEntry, CommentRecord, EvidenceRecord };

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  department: string | null;
  bio: string | null;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

export interface SessionRow {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

/* ------------------------------------------------------------------ */
/* Interface                                                           */
/* ------------------------------------------------------------------ */

export interface Storage {
  readonly kind: "sqlite" | "d1" | "memory";

  countUsers(): Promise<number>;
  getUserByEmail(email: string): Promise<UserRow | null>;
  getUserById(id: string): Promise<UserRow | null>;
  listUsers(): Promise<UserRow[]>;
  insertUser(user: UserRow): Promise<void>;
  updateUser(
    id: string,
    patch: Partial<Pick<UserRow, "role" | "name" | "jobTitle" | "department" | "bio">>,
  ): Promise<void>;
  deleteUser(id: string): Promise<void>;
  clearAllUsers(): Promise<number>;
  listRoleFunctions(role: Role): Promise<RoleFunctionRow[]>;
  listAllRoleFunctions(): Promise<RoleFunctionRow[]>;
  syncRoleFunctions(
    role: Role,
    functions: Array<{ key: string; description: string }>,
  ): Promise<void>;
  deleteRoleFunctions(role: Role): Promise<void>;

  listUserFunctions(userId: string): Promise<UserFunctionRow[]>;
  grantUserFunction(
    userId: string,
    functionKey: string,
    description: string,
    grantedBy: string | null,
    grantedAt?: string,
  ): Promise<boolean>;
  revokeUserFunction(userId: string, functionKey: string): Promise<boolean>;

  getSessionByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  insertSession(session: SessionRow): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
  purgeExpiredSessions(nowIso: string): Promise<void>;

  listColumns(): Promise<string[]>;
  insertColumn(name: string): Promise<boolean>;
  deleteColumn(name: string): Promise<boolean>;
  countTasksInColumn(name: string): Promise<number>;

  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  insertTask(task: Task): Promise<void>;
  updateTaskColumn(id: string, column: string): Promise<Task | null>;
  deleteTask(id: string): Promise<boolean>;

  listComments(): Promise<CommentRecord[]>;
  insertComment(comment: CommentRecord): Promise<void>;

  listControls(): Promise<ComplianceControl[]>;
  getControl(id: string): Promise<ComplianceControl | null>;
  insertControl(control: ComplianceControl): Promise<void>;
  deleteControl(id: string): Promise<boolean>;
  reviewControl(
    id: string,
    patch: Pick<ComplianceControl, "status" | "tone" | "lastReview" | "nextReview" | "overdue">,
  ): Promise<void>;

  listEvidences(): Promise<EvidenceRecord[]>;
  getEvidence(id: string): Promise<EvidenceRecord | null>;
  insertEvidence(evidence: EvidenceRecord): Promise<void>;
  reviewEvidence(
    id: string,
    patch: Pick<EvidenceRecord, "status" | "reviewerName" | "reviewedAt" | "note">,
  ): Promise<void>;

  insertAudit(record: AuditEntry): Promise<void>;
  listAudit(): Promise<AuditEntry[]>;
  countAudit(): Promise<number>;

  listModules(): Promise<Module[]>;
  insertModule(module: Module): Promise<void>;
  deleteModule(id: string): Promise<boolean>;

  listRisks(): Promise<Risk[]>;
  getRisk(id: string): Promise<Risk | null>;
  insertRisk(risk: Risk): Promise<void>;
  updateRisk(id: string, patch: Partial<Risk>): Promise<Risk | null>;
  deleteRisk(id: string): Promise<boolean>;

  listWiki(): Promise<WikiArticle[]>;
  getWiki(slug: string): Promise<WikiArticle | null>;
  insertWiki(article: WikiArticle): Promise<void>;
  updateWiki(slug: string, patch: Partial<WikiArticle>): Promise<WikiArticle | null>;
  deleteWiki(slug: string): Promise<boolean>;

  listMilestones(): Promise<Milestone[]>;
  insertMilestone(m: Milestone): Promise<void>;
  deleteMilestone(id: string): Promise<boolean>;

  listReleases(): Promise<Release[]>;
  insertRelease(r: Release): Promise<void>;
  deleteRelease(version: string): Promise<boolean>;

  listPatentStages(): Promise<PatentStage[]>;
  getPatentStage(id: string): Promise<PatentStage | null>;
  insertPatentStage(s: PatentStage): Promise<void>;
  updatePatentStage(id: string, patch: Partial<PatentStage>): Promise<PatentStage | null>;

  listTechStack(): Promise<TechItem[]>;
  insertTechStack(item: TechItem): Promise<void>;
  deleteTechStack(name: string): Promise<boolean>;

  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;

  listAutomationShares(): Promise<AutomationShare[]>;
  getAutomationShare(id: string): Promise<AutomationShare | null>;
  getAutomationShareByWorkflow(workflowId: string): Promise<AutomationShare | null>;
  upsertAutomationShare(share: AutomationShare): Promise<void>;
  deleteAutomationShare(id: string): Promise<boolean>;

  listNextSteps(): Promise<NextStep[]>;
  getNextStep(id: string): Promise<NextStep | null>;
  insertNextStep(step: NextStep): Promise<void>;
  updateNextStep(id: string, patch: Partial<NextStep>): Promise<NextStep | null>;
  deleteNextStep(id: string): Promise<boolean>;
  reorderNextSteps(orderedIds: string[]): Promise<void>;

  listLegalDocs(): Promise<LegalDoc[]>;
  getLegalDoc(slug: string): Promise<LegalDoc | null>;
  getLegalDocById(id: string): Promise<LegalDoc | null>;
  listLegalDocVersions(slug: string): Promise<LegalDoc[]>;
  insertLegalDoc(doc: LegalDoc): Promise<void>;

  listResetTokens(): Promise<ResetToken[]>;
  getResetTokenByHash(tokenHash: string): Promise<ResetToken | null>;
  insertResetToken(token: ResetToken): Promise<void>;
  markResetTokenUsed(tokenHash: string, usedAt: string): Promise<void>;
  deleteExpiredResetTokens(nowIso: string): Promise<void>;

  listSessionsForUser(userId: string): Promise<SessionRow[]>;
  exportDatabase(): Promise<DatabaseDump>;
  importDatabase(dump: DatabaseDump): Promise<void>;
  getStorageInfo(): Promise<StorageInfo>;

  listDocs(): Promise<DocRecord[]>;
  listDocsByKind(kind: string): Promise<DocRecord[]>;
  getDoc(id: string): Promise<DocRecord | null>;
  upsertDoc(doc: DocRecord): Promise<void>;
  deleteDoc(id: string): Promise<boolean>;

  insertInvite(invite: InviteRow): Promise<void>;
  listInvites(): Promise<InviteRow[]>;
  getInviteByHash(codeHash: string): Promise<InviteRow | null>;
  markInviteUsed(codeHash: string, usedAt: string, usedBy: string): Promise<void>;
  deleteInvite(id: string): Promise<boolean>;
}

export interface NextStep {
  id: string;
  title: string;
  due: string;
  status: "pendente" | "em_andamento" | "concluido";
  position: number;
  createdAt: string;
}

export interface LegalDoc {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  version: string;
  intro: string;
  clauses: { title: string; body: string }[];
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
}

export interface ResetToken {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface DatabaseDump {
  exportedAt: string;
  users: UserRow[];
  sessions: SessionRow[];
  columns: string[];
  tasks: Task[];
  comments: CommentRecord[];
  controls: ComplianceControl[];
  evidences: EvidenceRecord[];
  audit: AuditEntry[];
  modules: Module[];
  risks: Risk[];
  wiki: WikiArticle[];
  milestones: Milestone[];
  releases: Release[];
  patentStages: PatentStage[];
  techStack: TechItem[];
  automationShares: AutomationShare[];
  nextSteps: NextStep[];
  legalDocs: LegalDoc[];
  resetTokens: ResetToken[];
  meta: Record<string, string>;
  userFunctions: UserFunctionRow[];
}

export interface StorageInfo {
  kind: "sqlite" | "d1" | "memory";
  persistent: boolean;
  path: string;
  lastBackupAt: string | null;
  requirePersistent: boolean;
}

export interface AutomationShare {
  id: string;
  workflowId: string;
  workflowName: string;
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  sharedRole: string | null;
  sharedUserIds: string[];
  isPrivate: boolean;
  createdAt: string;
}

/** Registro genérico de módulo (riscos, marcos, releases, stack, equipe, patente, wiki). */
export interface InviteRow {
  id: string;
  codeHash: string;
  email: string;
  role: Role;
  /** Prefixo visível do código, para o admin reconhecer o convite. */
  hint: string;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
}

export interface RoleFunctionRow {
  role: Role;
  functionKey: string;
  description: string;
}

/** Função concedida individualmente a um usuário pelo admin. */
export interface UserFunctionRow {
  userId: string;
  functionKey: string;
  description: string;
  grantedAt: string;
  grantedBy: string | null;
}

/* ------------------------------------------------------------------ */
/* Driver SQLite                                                       */
/* ------------------------------------------------------------------ */

type SqlValue = string | number | bigint | Uint8Array | null;

interface SqlStatement {
  run(...params: SqlValue[]): { changes: number | bigint };
  get(...params: SqlValue[]): Record<string, SqlValue> | undefined;
  all(...params: SqlValue[]): Record<string, SqlValue>[];
}

interface SqlDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  role TEXT NOT NULL,
  job_title TEXT,
  department TEXT,
  bio TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS board_columns (
  position INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  column_name TEXT NOT NULL,
  priority TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  assignee TEXT NOT NULL DEFAULT '',
  due TEXT,
  comments INTEGER
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT NOT NULL,
  at TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS controls (
  id TEXT PRIMARY KEY,
  control TEXT NOT NULL,
  norm TEXT NOT NULL,
  owner TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'gestor',
  status TEXT NOT NULL,
  tone TEXT NOT NULL,
  last_review TEXT NOT NULL,
  next_review TEXT NOT NULL,
  overdue INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS evidences (
  id TEXT PRIMARY KEY,
  control_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  sent_by_id TEXT,
  sent_by_name TEXT NOT NULL,
  at TEXT NOT NULL,
  status TEXT NOT NULL,
  reviewer_name TEXT,
  reviewed_at TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS audit (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  at TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before TEXT,
  after TEXT,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit(entity, entity_id);
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  tone TEXT NOT NULL,
  date TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  owner TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'gestor',
  probability INTEGER NOT NULL,
  impact INTEGER NOT NULL,
  mitigation TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wiki_articles (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version TEXT NOT NULL,
  sections TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS releases (
  version TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  items TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS patent_stages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  owner TEXT NOT NULL,
  deadline TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tech_stack (
  name TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT
);
CREATE TABLE IF NOT EXISTS automation_shares (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL UNIQUE,
  workflow_name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  shared_role TEXT,
  shared_user_ids TEXT NOT NULL DEFAULT '[]',
  is_private INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS next_steps (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  due TEXT NOT NULL,
  status TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS legal_docs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  clauses TEXT NOT NULL DEFAULT '[]',
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by_id TEXT
);
CREATE INDEX IF NOT EXISTS legal_docs_slug_idx ON legal_docs(slug, published_at DESC);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS docs_kind_idx ON docs(kind);
CREATE TABLE IF NOT EXISTS invites (
  code_hash TEXT PRIMARY KEY,
  id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  hint TEXT NOT NULL,
  created_by TEXT,
  created_by_name TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by TEXT
);
CREATE TABLE IF NOT EXISTS role_functions (
  role TEXT NOT NULL,
  function_key TEXT NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY (role, function_key)
);
CREATE INDEX IF NOT EXISTS role_functions_role_idx ON role_functions(role);
CREATE TABLE IF NOT EXISTS user_functions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  function_key TEXT NOT NULL,
  description TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  granted_by TEXT,
  PRIMARY KEY (user_id, function_key)
);
CREATE INDEX IF NOT EXISTS user_functions_user_idx ON user_functions(user_id);
`;

const str = (v: SqlValue | undefined, fallback = ""): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback;
const nul = (v: SqlValue | undefined): string | null => (typeof v === "string" ? v : null);

function rowToUser(r: Record<string, SqlValue>): UserRow {
  return {
    id: str(r["id"]),
    name: str(r["name"]),
    email: str(r["email"]),
    role: str(r["role"]) as Role,
    jobTitle: nul(r["job_title"]),
    department: nul(r["department"]),
    bio: nul(r["bio"]),
    passwordHash: str(r["password_hash"]),
    passwordSalt: str(r["password_salt"]),
    createdAt: str(r["created_at"]),
  };
}

/**
 * Base com toda a lógica SQL compartilhada. Os drivers de baixo nível implementam
 * apenas as primitivas `one/many/run/exec`: node:sqlite (arquivo/memória) e o
 * binding Cloudflare D1. O adaptador D1 fica dormente até existir binding e a
 * flag STORAGE_D1=1 (ver `resolveD1Binding`).
 */
export abstract class SqliteBackend implements Storage {
  /** Último erro real ocorrido em `open` (usado para diagnóstico na interface). */
  static lastOpenError: string | null = null;

  abstract readonly kind: StorageInfo["kind"];

  protected abstract one(
    sql: string,
    ...params: SqlValue[]
  ): Promise<Record<string, SqlValue> | undefined>;
  protected abstract many(sql: string, ...params: SqlValue[]): Promise<Record<string, SqlValue>[]>;
  protected abstract run(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  protected abstract exec(sql: string): Promise<void>;

  protected async num(sql: string, ...params: SqlValue[]): Promise<number> {
    const r = await this.one(sql, ...params);
    return Number(r?.["n"] ?? 0);
  }

  async countUsers() {
    return await this.num("SELECT COUNT(*) AS n FROM users");
  }
  async getUserByEmail(email: string) {
    const r = await this.one("SELECT * FROM users WHERE email = ? COLLATE NOCASE", email.trim());
    return r ? rowToUser(r) : null;
  }
  async getUserById(id: string) {
    const r = await this.one("SELECT * FROM users WHERE id = ?", id);
    return r ? rowToUser(r) : null;
  }
  async listUsers() {
    return (await this.many("SELECT * FROM users ORDER BY created_at ASC, id ASC")).map(rowToUser);
  }
  async listRoleFunctions(role: Role): Promise<RoleFunctionRow[]> {
    return (
      await this.many(
        "SELECT role, function_key AS functionKey, description FROM role_functions WHERE role = ? ORDER BY function_key",
        role,
      )
    ).map((r) => ({
      role: r["role"] as Role,
      functionKey: r["functionKey"] as string,
      description: r["description"] as string,
    }));
  }
  async listAllRoleFunctions(): Promise<RoleFunctionRow[]> {
    return (
      await this.many(
        "SELECT role, function_key AS functionKey, description FROM role_functions ORDER BY role, function_key",
      )
    ).map((r) => ({
      role: r["role"] as Role,
      functionKey: r["functionKey"] as string,
      description: r["description"] as string,
    }));
  }
  async syncRoleFunctions(
    role: Role,
    functions: Array<{ key: string; description: string }>,
  ): Promise<void> {
    await this.run("DELETE FROM role_functions WHERE role = ?", role);
    for (const f of functions) {
      await this.run(
        "INSERT INTO role_functions (role, function_key, description) VALUES (?, ?, ?)",
        role,
        f.key,
        f.description,
      );
    }
  }
  async deleteRoleFunctions(role: Role): Promise<void> {
    await this.run("DELETE FROM role_functions WHERE role = ?", role);
  }
  async listUserFunctions(userId: string): Promise<UserFunctionRow[]> {
    return (
      await this.many(
        "SELECT user_id AS userId, function_key AS functionKey, description, granted_at AS grantedAt, granted_by AS grantedBy FROM user_functions WHERE user_id = ? ORDER BY function_key",
        userId,
      )
    ).map((r) => ({
      userId: r["userId"] as string,
      functionKey: r["functionKey"] as string,
      description: r["description"] as string,
      grantedAt: r["grantedAt"] as string,
      grantedBy: r["grantedBy"] == null ? null : (r["grantedBy"] as string),
    }));
  }
  async grantUserFunction(
    userId: string,
    functionKey: string,
    description: string,
    grantedBy: string | null,
    grantedAt = new Date().toISOString(),
  ): Promise<boolean> {
    const info = await this.run(
      "INSERT OR IGNORE INTO user_functions (user_id, function_key, description, granted_at, granted_by) VALUES (?, ?, ?, ?, ?)",
      userId,
      functionKey,
      description,
      grantedAt,
      grantedBy,
    );
    return Number(info.changes) > 0;
  }
  async revokeUserFunction(userId: string, functionKey: string): Promise<boolean> {
    const info = await this.run(
      "DELETE FROM user_functions WHERE user_id = ? AND function_key = ?",
      userId,
      functionKey,
    );
    return Number(info.changes) > 0;
  }
  async insertUser(u: UserRow) {
    await this.run(
      "INSERT INTO users (id, name, email, role, job_title, department, bio, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      u.id,
      u.name,
      u.email,
      u.role,
      u.jobTitle ?? null,
      u.department ?? null,
      u.bio ?? null,
      u.passwordHash,
      u.passwordSalt,
      u.createdAt,
      u.createdAt,
    );
  }
  async updateUser(
    id: string,
    patch: Partial<Pick<UserRow, "role" | "name" | "jobTitle" | "department" | "bio">>,
  ) {
    const sets: string[] = [];
    const params: SqlValue[] = [];
    if (patch.role !== undefined) {
      sets.push("role = ?");
      params.push(patch.role);
    }
    if (patch.name !== undefined) {
      sets.push("name = ?");
      params.push(patch.name);
    }
    if (patch.jobTitle !== undefined) {
      sets.push("job_title = ?");
      params.push(patch.jobTitle);
    }
    if (patch.department !== undefined) {
      sets.push("department = ?");
      params.push(patch.department);
    }
    if (patch.bio !== undefined) {
      sets.push("bio = ?");
      params.push(patch.bio);
    }
    if (!sets.length) return;
    sets.push("updated_at = ?");
    params.push(new Date().toISOString(), id);
    await this.run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, ...params);
  }
  async deleteUser(id: string) {
    await this.run("DELETE FROM sessions WHERE user_id = ?", id);
    await this.run("DELETE FROM users WHERE id = ?", id);
  }
  async clearAllUsers() {
    const n = await this.num("SELECT COUNT(*) AS n FROM users");
    await this.run("DELETE FROM sessions");
    await this.run("DELETE FROM users");
    return n;
  }

  async getSessionByTokenHash(tokenHash: string) {
    const r = await this.one("SELECT * FROM sessions WHERE token_hash = ?", tokenHash);
    if (!r) return null;
    return {
      tokenHash: str(r["token_hash"]),
      userId: str(r["user_id"]),
      createdAt: str(r["created_at"]),
      expiresAt: str(r["expires_at"]),
    };
  }
  async insertSession(s: SessionRow) {
    await this.run(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      s.tokenHash,
      s.userId,
      s.createdAt,
      s.expiresAt,
    );
  }
  async deleteSession(tokenHash: string) {
    await this.run("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
  }
  async deleteSessionsForUser(userId: string) {
    await this.run("DELETE FROM sessions WHERE user_id = ?", userId);
  }
  async purgeExpiredSessions(nowIso: string) {
    await this.run("DELETE FROM sessions WHERE expires_at < ?", nowIso);
  }

  async listColumns() {
    return (await this.many("SELECT name FROM board_columns ORDER BY position ASC")).map((r) =>
      str(r["name"]),
    );
  }
  async insertColumn(name: string) {
    const pos = await this.num("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM board_columns");
    const res = await this.run(
      "INSERT OR IGNORE INTO board_columns (position, name) VALUES (?, ?)",
      pos,
      name,
    );
    return Number(res.changes) > 0;
  }
  async deleteColumn(name: string) {
    if ((await this.countTasksInColumn(name)) > 0) return false;
    const res = await this.run("DELETE FROM board_columns WHERE name = ?", name);
    return Number(res.changes) > 0;
  }
  async countTasksInColumn(name: string) {
    return await this.num("SELECT COUNT(*) AS n FROM tasks WHERE column_name = ?", name);
  }

  async listTasks() {
    return (await this.many("SELECT * FROM tasks ORDER BY rowid DESC")).map((r): Task => ({
      id: str(r["id"]),
      title: str(r["title"]),
      description: str(r["description"]),
      column: str(r["column_name"]),
      priority: str(r["priority"]) as Priority,
      tags: safeTags(r["tags"]),
      assignee: str(r["assignee"]),
      ...(nul(r["due"]) ? { due: str(r["due"]) } : {}),
      ...(r["comments"] == null ? {} : { comments: Number(r["comments"]) }),
    }));
  }
  async getTask(id: string) {
    const r = await this.one("SELECT * FROM tasks WHERE id = ?", id);
    if (!r) return null;
    return {
      id: str(r["id"]),
      title: str(r["title"]),
      description: str(r["description"]),
      column: str(r["column_name"]),
      priority: str(r["priority"]) as Priority,
      tags: safeTags(r["tags"]),
      assignee: str(r["assignee"]),
      ...(nul(r["due"]) ? { due: str(r["due"]) } : {}),
      ...(r["comments"] == null ? {} : { comments: Number(r["comments"]) }),
    };
  }
  async insertTask(t: Task) {
    await this.run(
      "INSERT INTO tasks (id, title, description, column_name, priority, tags, assignee, due, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      t.id,
      t.title,
      t.description,
      t.column,
      t.priority,
      JSON.stringify(t.tags),
      t.assignee,
      t.due ?? null,
      t.comments ?? null,
    );
  }
  async updateTaskColumn(id: string, column: string) {
    const task = await this.getTask(id);
    if (!task) return null;
    await this.run("UPDATE tasks SET column_name = ? WHERE id = ?", column, id);
    return { ...task, column };
  }
  async deleteTask(id: string) {
    const info = await this.run("DELETE FROM tasks WHERE id = ?", id);
    return Number(info.changes) > 0;
  }

  async listComments() {
    return (await this.many("SELECT * FROM comments ORDER BY at ASC, rowid ASC")).map(
      (r): CommentRecord => ({
        id: str(r["id"]),
        taskId: str(r["task_id"]),
        authorId: nul(r["author_id"]),
        authorName: str(r["author_name"]),
        at: str(r["at"]),
        body: str(r["body"]),
      }),
    );
  }
  async insertComment(c: CommentRecord) {
    await this.run(
      "INSERT INTO comments (id, task_id, author_id, author_name, at, body) VALUES (?, ?, ?, ?, ?, ?)",
      c.id,
      c.taskId,
      c.authorId,
      c.authorName,
      c.at,
      c.body,
    );
  }

  async listControls() {
    return (await this.many("SELECT * FROM controls ORDER BY rowid ASC")).map(
      (r): ComplianceControl => ({
        id: str(r["id"]),
        control: str(r["control"]),
        norm: str(r["norm"]) as ComplianceControl["norm"],
        owner: str(r["owner"]),
        role: (str(r["role"]) || "gestor") as ComplianceControl["role"],
        status: str(r["status"]),
        tone: str(r["tone"]) as ComplianceControl["tone"],
        lastReview: str(r["last_review"]),
        nextReview: str(r["next_review"]),
        overdue: Boolean(r["overdue"]),
      }),
    );
  }
  async getControl(id: string) {
    return (await this.listControls()).find((c) => c.id === id) ?? null;
  }
  async insertControl(c: ComplianceControl) {
    await this.run(
      "INSERT OR IGNORE INTO controls (id, control, norm, owner, role, status, tone, last_review, next_review, overdue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      c.id,
      c.control,
      c.norm,
      c.owner,
      c.role ?? "gestor",
      c.status,
      c.tone,
      c.lastReview,
      c.nextReview,
      c.overdue ? 1 : 0,
    );
  }
  async reviewControl(
    id: string,
    patch: Pick<ComplianceControl, "status" | "tone" | "lastReview" | "nextReview" | "overdue">,
  ) {
    await this.run(
      "UPDATE controls SET status = ?, tone = ?, last_review = ?, next_review = ?, overdue = ? WHERE id = ?",
      patch.status,
      patch.tone,
      patch.lastReview,
      patch.nextReview,
      patch.overdue ? 1 : 0,
      id,
    );
  }
  async deleteControl(id: string) {
    const res = await this.run("DELETE FROM controls WHERE id = ?", id);
    return Number(res.changes) > 0;
  }

  async listEvidences() {
    return (await this.many("SELECT * FROM evidences ORDER BY at DESC, rowid DESC")).map(
      (r): EvidenceRecord => ({
        id: str(r["id"]),
        controlId: str(r["control_id"]),
        fileName: str(r["file_name"]),
        sentById: nul(r["sent_by_id"]),
        sentByName: str(r["sent_by_name"]),
        at: str(r["at"]),
        status: str(r["status"]) as EvidenceRecord["status"],
        ...(nul(r["reviewer_name"]) ? { reviewerName: str(r["reviewer_name"]) } : {}),
        ...(nul(r["reviewed_at"]) ? { reviewedAt: str(r["reviewed_at"]) } : {}),
        ...(nul(r["note"]) ? { note: str(r["note"]) } : {}),
      }),
    );
  }
  async getEvidence(id: string) {
    return (await this.listEvidences()).find((e) => e.id === id) ?? null;
  }
  async insertEvidence(e: EvidenceRecord) {
    await this.run(
      "INSERT INTO evidences (id, control_id, file_name, sent_by_id, sent_by_name, at, status, reviewer_name, reviewed_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      e.id,
      e.controlId,
      e.fileName,
      e.sentById,
      e.sentByName,
      e.at,
      e.status,
      e.reviewerName ?? null,
      e.reviewedAt ?? null,
      e.note ?? null,
    );
  }
  async reviewEvidence(
    id: string,
    patch: Pick<EvidenceRecord, "status" | "reviewerName" | "reviewedAt" | "note">,
  ) {
    await this.run(
      "UPDATE evidences SET status = ?, reviewer_name = ?, reviewed_at = ?, note = ? WHERE id = ?",
      patch.status,
      patch.reviewerName ?? null,
      patch.reviewedAt ?? null,
      patch.note ?? null,
      id,
    );
  }

  async insertAudit(a: AuditEntry) {
    await this.run(
      "INSERT INTO audit (id, at, actor_id, actor_name, actor_role, action, entity, entity_id, before, after, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      a.id,
      a.at,
      a.actorId,
      a.actor,
      a.actorRole,
      a.action,
      a.entity,
      a.entityId,
      a.before ?? null,
      a.after ?? null,
      a.reason ?? null,
    );
  }
  async listAudit() {
    return (await this.many("SELECT * FROM audit ORDER BY seq DESC")).map((r): AuditEntry => ({
      id: str(r["id"]),
      at: str(r["at"]),
      actorId: nul(r["actor_id"]),
      actor: str(r["actor"]),
      actorRole: str(r["actor_role"]) as AuditEntry["actorRole"],
      action: str(r["action"]),
      entity: str(r["entity"]),
      entityId: str(r["entity_id"]),
      ...(nul(r["before"]) ? { before: str(r["before"]) } : {}),
      ...(nul(r["after"]) ? { after: str(r["after"]) } : {}),
      ...(nul(r["reason"]) ? { reason: str(r["reason"]) } : {}),
    }));
  }
  async countAudit() {
    return await this.num("SELECT COUNT(*) AS n FROM audit");
  }

  async listModules() {
    return (await this.many("SELECT * FROM modules ORDER BY rowid ASC")).map((r): Module => ({
      id: str(r["id"]),
      name: str(r["name"]),
      status: str(r["status"]),
      tone: str(r["tone"]) as Module["tone"],
      date: str(r["date"]),
      done: Number(r["done"] ?? 0),
      total: Number(r["total"] ?? 0),
    }));
  }
  async insertModule(m: Module) {
    await this.run(
      "INSERT OR IGNORE INTO modules (id, name, status, tone, date, done, total) VALUES (?, ?, ?, ?, ?, ?, ?)",
      m.id,
      m.name,
      m.status,
      m.tone,
      m.date,
      m.done,
      m.total,
    );
  }
  async deleteModule(id: string) {
    const res = await this.run("DELETE FROM modules WHERE id = ?", id);
    return Number(res.changes) > 0;
  }

  async listRisks() {
    return (await this.many("SELECT * FROM risks ORDER BY rowid ASC")).map((r): Risk => ({
      id: str(r["id"]),
      title: str(r["title"]),
      category: str(r["category"]),
      owner: str(r["owner"]),
      role: (str(r["role"]) || "gestor") as Risk["role"],
      probability: Number(r["probability"]) as Risk["probability"],
      impact: Number(r["impact"]) as Risk["impact"],
      mitigation: str(r["mitigation"]),
    }));
  }
  async getRisk(id: string) {
    const r = await this.one("SELECT * FROM risks WHERE id = ?", id);
    if (!r) return null;
    return {
      id: str(r["id"]),
      title: str(r["title"]),
      category: str(r["category"]),
      owner: str(r["owner"]),
      role: (str(r["role"]) || "gestor") as Risk["role"],
      probability: Number(r["probability"]) as Risk["probability"],
      impact: Number(r["impact"]) as Risk["impact"],
      mitigation: str(r["mitigation"]),
    };
  }
  async insertRisk(r: Risk) {
    await this.run(
      "INSERT OR IGNORE INTO risks (id, title, category, owner, role, probability, impact, mitigation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      r.id,
      r.title,
      r.category,
      r.owner,
      r.role ?? "gestor",
      r.probability,
      r.impact,
      r.mitigation,
    );
  }
  async updateRisk(id: string, patch: Partial<Risk>) {
    const cur = await this.getRisk(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, id };
    await this.run(
      "UPDATE risks SET title = ?, category = ?, owner = ?, role = ?, probability = ?, impact = ?, mitigation = ? WHERE id = ?",
      next.title,
      next.category,
      next.owner,
      next.role,
      next.probability,
      next.impact,
      next.mitigation,
      id,
    );
    return next;
  }
  async deleteRisk(id: string) {
    const res = await this.run("DELETE FROM risks WHERE id = ?", id);
    return Number(res.changes) > 0;
  }

  async listWiki() {
    return (await this.many("SELECT * FROM wiki_articles ORDER BY rowid ASC")).map(
      (r): WikiArticle => ({
        slug: str(r["slug"]),
        title: str(r["title"]),
        category: str(r["category"]),
        summary: str(r["summary"]),
        updatedAt: str(r["updated_at"]),
        version: str(r["version"]),
        sections: safeJson(r["sections"], []),
      }),
    );
  }
  async getWiki(slug: string) {
    const r = await this.one("SELECT * FROM wiki_articles WHERE slug = ?", slug);
    if (!r) return null;
    return {
      slug: str(r["slug"]),
      title: str(r["title"]),
      category: str(r["category"]),
      summary: str(r["summary"]),
      updatedAt: str(r["updated_at"]),
      version: str(r["version"]),
      sections: safeJson(r["sections"], []),
    };
  }
  async insertWiki(a: WikiArticle) {
    await this.run(
      "INSERT OR IGNORE INTO wiki_articles (slug, title, category, summary, updated_at, version, sections) VALUES (?, ?, ?, ?, ?, ?, ?)",
      a.slug,
      a.title,
      a.category,
      a.summary,
      a.updatedAt,
      a.version,
      JSON.stringify(a.sections),
    );
  }
  async updateWiki(slug: string, patch: Partial<WikiArticle>) {
    const cur = await this.getWiki(slug);
    if (!cur) return null;
    const next = { ...cur, ...patch, slug };
    await this.run(
      "UPDATE wiki_articles SET title = ?, category = ?, summary = ?, updated_at = ?, version = ?, sections = ? WHERE slug = ?",
      next.title,
      next.category,
      next.summary,
      next.updatedAt,
      next.version,
      JSON.stringify(next.sections),
      slug,
    );
    return next;
  }
  async deleteWiki(slug: string) {
    const res = await this.run("DELETE FROM wiki_articles WHERE slug = ?", slug);
    return Number(res.changes) > 0;
  }

  async listMilestones() {
    return (await this.many("SELECT * FROM milestones ORDER BY rowid ASC")).map((r): Milestone => ({
      id: str(r["id"]),
      date: str(r["date"]),
      type: str(r["type"]) as Milestone["type"],
      title: str(r["title"]),
      description: str(r["description"]),
    }));
  }
  async insertMilestone(m: Milestone) {
    await this.run(
      "INSERT OR IGNORE INTO milestones (id, date, type, title, description) VALUES (?, ?, ?, ?, ?)",
      m.id,
      m.date,
      m.type,
      m.title,
      m.description,
    );
  }
  async deleteMilestone(id: string) {
    const res = await this.run("DELETE FROM milestones WHERE id = ?", id);
    return Number(res.changes) > 0;
  }

  async listReleases() {
    return (await this.many("SELECT * FROM releases ORDER BY rowid DESC")).map((r): Release => ({
      version: str(r["version"]),
      date: str(r["date"]),
      items: safeJson(r["items"], []),
    }));
  }
  async insertRelease(r: Release) {
    await this.run(
      "INSERT OR IGNORE INTO releases (version, date, items) VALUES (?, ?, ?)",
      r.version,
      r.date,
      JSON.stringify(r.items),
    );
  }
  async deleteRelease(version: string) {
    const res = await this.run("DELETE FROM releases WHERE version = ?", version);
    return Number(res.changes) > 0;
  }

  async listPatentStages() {
    return (await this.many("SELECT * FROM patent_stages ORDER BY rowid ASC")).map(
      (r): PatentStage => ({
        id: str(r["id"]),
        title: str(r["title"]),
        description: str(r["description"]),
        owner: str(r["owner"]),
        deadline: str(r["deadline"]),
        status: str(r["status"]) as PatentStage["status"],
      }),
    );
  }
  async getPatentStage(id: string) {
    const r = await this.one("SELECT * FROM patent_stages WHERE id = ?", id);
    if (!r) return null;
    return {
      id: str(r["id"]),
      title: str(r["title"]),
      description: str(r["description"]),
      owner: str(r["owner"]),
      deadline: str(r["deadline"]),
      status: str(r["status"]) as PatentStage["status"],
    };
  }
  async insertPatentStage(s: PatentStage) {
    await this.run(
      "INSERT OR IGNORE INTO patent_stages (id, title, description, owner, deadline, status) VALUES (?, ?, ?, ?, ?, ?)",
      s.id,
      s.title,
      s.description,
      s.owner,
      s.deadline,
      s.status,
    );
  }
  async updatePatentStage(id: string, patch: Partial<PatentStage>) {
    const cur = await this.getPatentStage(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, id };
    await this.run(
      "UPDATE patent_stages SET title = ?, description = ?, owner = ?, deadline = ?, status = ? WHERE id = ?",
      next.title,
      next.description,
      next.owner,
      next.deadline,
      next.status,
      id,
    );
    return next;
  }

  async listTechStack() {
    return (await this.many("SELECT * FROM tech_stack ORDER BY rowid ASC")).map((r): TechItem => ({
      name: str(r["name"]),
      category: str(r["category"]),
      description: str(r["description"]),
      ...(nul(r["icon"]) ? ({ icon: str(r["icon"]) } as unknown as TechItem) : {}),
    })) as TechItem[];
  }
  async insertTechStack(item: TechItem & { icon?: string }) {
    await this.run(
      "INSERT OR IGNORE INTO tech_stack (name, category, description, icon) VALUES (?, ?, ?, ?)",
      item.name,
      item.category,
      item.description,
      (item as unknown as { icon?: string }).icon ?? null,
    );
  }
  async deleteTechStack(name: string) {
    const res = await this.run("DELETE FROM tech_stack WHERE name = ?", name);
    return Number(res.changes) > 0;
  }

  async getMeta(key: string) {
    const r = await this.one("SELECT value FROM meta WHERE key = ?", key);
    return r ? str(r["value"]) : null;
  }
  async setMeta(key: string, value: string) {
    await this.run(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
  }

  async listAutomationShares() {
    return (await this.many("SELECT * FROM automation_shares ORDER BY created_at DESC")).map(
      (r): AutomationShare => ({
        id: str(r["id"]),
        workflowId: str(r["workflow_id"]),
        workflowName: str(r["workflow_name"]),
        ownerId: str(r["owner_id"]),
        ownerName: str(r["owner_name"]),
        ownerRole: str(r["owner_role"]),
        sharedRole: nul(r["shared_role"]),
        sharedUserIds: safeJson(r["shared_user_ids"], []),
        isPrivate: Boolean(r["is_private"]),
        createdAt: str(r["created_at"]),
      }),
    );
  }
  async getAutomationShare(id: string) {
    const r = await this.one("SELECT * FROM automation_shares WHERE id = ?", id);
    if (!r) return null;
    return {
      id: str(r["id"]),
      workflowId: str(r["workflow_id"]),
      workflowName: str(r["workflow_name"]),
      ownerId: str(r["owner_id"]),
      ownerName: str(r["owner_name"]),
      ownerRole: str(r["owner_role"]),
      sharedRole: nul(r["shared_role"]),
      sharedUserIds: safeJson(r["shared_user_ids"], []),
      isPrivate: Boolean(r["is_private"]),
      createdAt: str(r["created_at"]),
    };
  }
  async getAutomationShareByWorkflow(workflowId: string) {
    const r = await this.one("SELECT * FROM automation_shares WHERE workflow_id = ?", workflowId);
    if (!r) return null;
    return this.getAutomationShare(str(r["id"]));
  }
  async upsertAutomationShare(s: AutomationShare) {
    await this.run(
      "INSERT INTO automation_shares (id, workflow_id, workflow_name, owner_id, owner_name, owner_role, shared_role, shared_user_ids, is_private, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workflow_id) DO UPDATE SET workflow_name=excluded.workflow_name, shared_role=excluded.shared_role, shared_user_ids=excluded.shared_user_ids, is_private=excluded.is_private",
      s.id,
      s.workflowId,
      s.workflowName,
      s.ownerId,
      s.ownerName,
      s.ownerRole,
      s.sharedRole,
      JSON.stringify(s.sharedUserIds),
      s.isPrivate ? 1 : 0,
      s.createdAt,
    );
  }
  async deleteAutomationShare(id: string) {
    const res = await this.run("DELETE FROM automation_shares WHERE id = ?", id);
    return Number(res.changes) > 0;
  }

  async listNextSteps() {
    return (await this.many("SELECT * FROM next_steps ORDER BY position ASC, created_at ASC")).map(
      (r): NextStep => ({
        id: str(r["id"]),
        title: str(r["title"]),
        due: str(r["due"]),
        status: str(r["status"]) as NextStep["status"],
        position: Number(r["position"]),
        createdAt: str(r["created_at"]),
      }),
    );
  }
  async getNextStep(id: string) {
    const r = await this.one("SELECT * FROM next_steps WHERE id = ?", id);
    if (!r) return null;
    return {
      id: str(r["id"]),
      title: str(r["title"]),
      due: str(r["due"]),
      status: str(r["status"]) as NextStep["status"],
      position: Number(r["position"]),
      createdAt: str(r["created_at"]),
    };
  }
  async insertNextStep(s: NextStep) {
    await this.run(
      "INSERT OR IGNORE INTO next_steps (id, title, due, status, position, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      s.id,
      s.title,
      s.due,
      s.status,
      s.position,
      s.createdAt,
    );
  }
  async updateNextStep(id: string, patch: Partial<NextStep>) {
    const cur = await this.getNextStep(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, id };
    await this.run(
      "UPDATE next_steps SET title = ?, due = ?, status = ?, position = ? WHERE id = ?",
      next.title,
      next.due,
      next.status,
      next.position,
      id,
    );
    return next;
  }
  async deleteNextStep(id: string) {
    const res = await this.run("DELETE FROM next_steps WHERE id = ?", id);
    return Number(res.changes) > 0;
  }
  async reorderNextSteps(orderedIds: string[]) {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (id) await this.run("UPDATE next_steps SET position = ? WHERE id = ?", i, id);
    }
  }

  async listLegalDocs() {
    const rows = await this.many(
      "SELECT * FROM legal_docs WHERE id IN (SELECT id FROM legal_docs GROUP BY slug HAVING MAX(published_at)) ORDER BY slug ASC",
    );
    if (rows.length === 0)
      return (await this.many("SELECT * FROM legal_docs ORDER BY slug ASC, published_at DESC")).map(
        (r): LegalDoc => ({
          id: str(r["id"]),
          slug: str(r["slug"]),
          title: str(r["title"]),
          subtitle: str(r["subtitle"]),
          version: str(r["version"]),
          intro: str(r["intro"]),
          clauses: safeJson(r["clauses"], []),
          publishedAt: str(r["published_at"]),
          createdAt: str(r["created_at"]),
          updatedAt: str(r["updated_at"]),
          createdById: nul(r["created_by_id"]),
        }),
      ) as LegalDoc[];
    const latest = new Map<string, Record<string, SqlValue>>();
    for (const r of await this.many("SELECT * FROM legal_docs ORDER BY published_at DESC")) {
      const slug = str(r["slug"]);
      if (!latest.has(slug)) latest.set(slug, r);
    }
    return Array.from(latest.values()).map((r): LegalDoc => ({
      id: str(r["id"]),
      slug: str(r["slug"]),
      title: str(r["title"]),
      subtitle: str(r["subtitle"]),
      version: str(r["version"]),
      intro: str(r["intro"]),
      clauses: safeJson(r["clauses"], []),
      publishedAt: str(r["published_at"]),
      createdAt: str(r["created_at"]),
      updatedAt: str(r["updated_at"]),
      createdById: nul(r["created_by_id"]),
    }));
  }
  async getLegalDoc(slug: string) {
    const r = await this.one(
      "SELECT * FROM legal_docs WHERE slug = ? ORDER BY published_at DESC LIMIT 1",
      slug,
    );
    if (!r) return null;
    return {
      id: str(r["id"]),
      slug: str(r["slug"]),
      title: str(r["title"]),
      subtitle: str(r["subtitle"]),
      version: str(r["version"]),
      intro: str(r["intro"]),
      clauses: safeJson(r["clauses"], []),
      publishedAt: str(r["published_at"]),
      createdAt: str(r["created_at"]),
      updatedAt: str(r["updated_at"]),
      createdById: nul(r["created_by_id"]),
    };
  }
  async getLegalDocById(id: string) {
    const r = await this.one("SELECT * FROM legal_docs WHERE id = ?", id);
    if (!r) return null;
    return {
      id: str(r["id"]),
      slug: str(r["slug"]),
      title: str(r["title"]),
      subtitle: str(r["subtitle"]),
      version: str(r["version"]),
      intro: str(r["intro"]),
      clauses: safeJson(r["clauses"], []),
      publishedAt: str(r["published_at"]),
      createdAt: str(r["created_at"]),
      updatedAt: str(r["updated_at"]),
      createdById: nul(r["created_by_id"]),
    };
  }
  async listLegalDocVersions(slug: string) {
    return (
      await this.many("SELECT * FROM legal_docs WHERE slug = ? ORDER BY published_at DESC", slug)
    ).map((r): LegalDoc => ({
      id: str(r["id"]),
      slug: str(r["slug"]),
      title: str(r["title"]),
      subtitle: str(r["subtitle"]),
      version: str(r["version"]),
      intro: str(r["intro"]),
      clauses: safeJson(r["clauses"], []),
      publishedAt: str(r["published_at"]),
      createdAt: str(r["created_at"]),
      updatedAt: str(r["updated_at"]),
      createdById: nul(r["created_by_id"]),
    }));
  }
  async insertLegalDoc(doc: LegalDoc) {
    await this.run(
      "INSERT INTO legal_docs (id, slug, title, subtitle, version, intro, clauses, published_at, created_at, updated_at, created_by_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      doc.id,
      doc.slug,
      doc.title,
      doc.subtitle,
      doc.version,
      doc.intro,
      JSON.stringify(doc.clauses),
      doc.publishedAt,
      doc.createdAt,
      doc.updatedAt,
      doc.createdById,
    );
  }

  async listResetTokens() {
    return (await this.many("SELECT * FROM password_reset_tokens ORDER BY created_at DESC")).map(
      (r) => ({
        tokenHash: str(r["token_hash"]),
        userId: str(r["user_id"]),
        createdAt: str(r["created_at"]),
        expiresAt: str(r["expires_at"]),
        usedAt: nul(r["used_at"]),
      }),
    );
  }
  async getResetTokenByHash(tokenHash: string) {
    const r = await this.one("SELECT * FROM password_reset_tokens WHERE token_hash = ?", tokenHash);
    if (!r) return null;
    return {
      tokenHash: str(r["token_hash"]),
      userId: str(r["user_id"]),
      createdAt: str(r["created_at"]),
      expiresAt: str(r["expires_at"]),
      usedAt: nul(r["used_at"]),
    };
  }
  async insertResetToken(t: ResetToken) {
    await this.run(
      "INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?)",
      t.tokenHash,
      t.userId,
      t.createdAt,
      t.expiresAt,
      t.usedAt,
    );
  }
  async markResetTokenUsed(tokenHash: string, usedAt: string) {
    await this.run(
      "UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?",
      usedAt,
      tokenHash,
    );
  }
  async deleteExpiredResetTokens(nowIso: string) {
    await this.run(
      "DELETE FROM password_reset_tokens WHERE expires_at < ? AND used_at IS NULL",
      nowIso,
    );
  }

  async listSessionsForUser(userId: string) {
    return (
      await this.many("SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC", userId)
    ).map((r) => ({
      tokenHash: str(r["token_hash"]),
      userId: str(r["user_id"]),
      createdAt: str(r["created_at"]),
      expiresAt: str(r["expires_at"]),
    }));
  }
  async exportDatabase(): Promise<DatabaseDump> {
    const [
      users,
      sessions,
      columns,
      tasks,
      comments,
      controls,
      evidences,
      audit,
      modules,
      risks,
      wiki,
      milestones,
      releases,
      patentStages,
      techStack,
      automationShares,
      nextSteps,
      legalDocs,
      resetTokens,
      metaRows,
      userFunctions,
    ] = await Promise.all([
      this.listUsers(),
      (await this.many("SELECT * FROM sessions")).map((r) => ({
        tokenHash: str(r["token_hash"]),
        userId: str(r["user_id"]),
        createdAt: str(r["created_at"]),
        expiresAt: str(r["expires_at"]),
      })) as SessionRow[],
      this.listColumns(),
      this.listTasks(),
      this.listComments(),
      this.listControls(),
      this.listEvidences(),
      this.listAudit(),
      this.listModules(),
      this.listRisks(),
      this.listWiki(),
      this.listMilestones(),
      this.listReleases(),
      this.listPatentStages(),
      this.listTechStack(),
      this.listAutomationShares(),
      this.listNextSteps(),
      (await this.many("SELECT * FROM legal_docs ORDER BY published_at DESC")).map(
        (r): LegalDoc => ({
          id: str(r["id"]),
          slug: str(r["slug"]),
          title: str(r["title"]),
          subtitle: str(r["subtitle"]),
          version: str(r["version"]),
          intro: str(r["intro"]),
          clauses: safeJson(r["clauses"], []),
          publishedAt: str(r["published_at"]),
          createdAt: str(r["created_at"]),
          updatedAt: str(r["updated_at"]),
          createdById: nul(r["created_by_id"]),
        }),
      ),
      this.listResetTokens(),
      await this.many("SELECT * FROM meta"),
      (
        await this.many(
          "SELECT user_id AS userId, function_key AS functionKey, description, granted_at AS grantedAt, granted_by AS grantedBy FROM user_functions ORDER BY user_id, function_key",
        )
      ).map((r): UserFunctionRow => ({
        userId: str(r["userId"]),
        functionKey: str(r["functionKey"]),
        description: str(r["description"]),
        grantedAt: str(r["grantedAt"]),
        grantedBy: nul(r["grantedBy"]),
      })),
    ]);
    const meta: Record<string, string> = {};
    for (const r of metaRows) meta[str(r["key"])] = str(r["value"]);
    return {
      exportedAt: new Date().toISOString(),
      users,
      sessions: sessions as SessionRow[],
      columns,
      tasks,
      comments,
      controls,
      evidences,
      audit: audit as AuditEntry[],
      modules,
      risks,
      wiki,
      milestones,
      releases,
      patentStages,
      techStack,
      automationShares,
      nextSteps,
      legalDocs: legalDocs as LegalDoc[],
      resetTokens,
      meta,
      userFunctions,
    };
  }
  async importDatabase(dump: DatabaseDump): Promise<void> {
    await this.exec("BEGIN");
    try {
      const tables = [
        "users",
        "sessions",
        "board_columns",
        "tasks",
        "comments",
        "controls",
        "evidences",
        "audit",
        "modules",
        "risks",
        "wiki_articles",
        "milestones",
        "releases",
        "patent_stages",
        "tech_stack",
        "automation_shares",
        "next_steps",
        "legal_docs",
        "password_reset_tokens",
        "user_functions",
        "meta",
      ];
      for (const t of tables) await this.exec(`DELETE FROM ${t}`);
      for (const u of dump.users) await this.insertUser(u);
      for (const s of dump.sessions) await this.insertSession(s as SessionRow);
      for (const c of dump.columns) await this.insertColumn(c);
      for (const t of dump.tasks) await this.insertTask(t);
      for (const c of dump.comments) await this.insertComment(c);
      for (const c of dump.controls) await this.insertControl(c);
      for (const e of dump.evidences) await this.insertEvidence(e);
      for (const a of dump.audit) await this.insertAudit(a as AuditEntry);
      for (const m of dump.modules) await this.insertModule(m);
      for (const r of dump.risks) await this.insertRisk(r);
      for (const w of dump.wiki) await this.insertWiki(w);
      for (const m of dump.milestones) await this.insertMilestone(m);
      for (const r of dump.releases) await this.insertRelease(r);
      for (const p of dump.patentStages) await this.insertPatentStage(p);
      for (const t of dump.techStack) await this.insertTechStack(t as TechItem);
      for (const a of dump.automationShares) await this.upsertAutomationShare(a);
      for (const n of dump.nextSteps) await this.insertNextStep(n);
      for (const l of dump.legalDocs) await this.insertLegalDoc(l);
      for (const r of dump.resetTokens) await this.insertResetToken(r);
      for (const uf of dump.userFunctions ?? [])
        await this.grantUserFunction(
          uf.userId,
          uf.functionKey,
          uf.description,
          uf.grantedBy,
          uf.grantedAt,
        );
      for (const [k, v] of Object.entries(dump.meta ?? {})) await this.setMeta(k, v);
      await this.exec("COMMIT");
    } catch (e) {
      await this.exec("ROLLBACK");
      throw e;
    }
  }
  async getStorageInfo(): Promise<StorageInfo> {
    return {
      kind: this.kind,
      persistent: true,
      path: resolveDatabasePath(),
      lastBackupAt: await this.getMeta("last_backup_at"),
      requirePersistent: isRequirePersistent(),
    };
  }
  /* --- registros genéricos de módulo --- */
  async listDocs() {
    return (await this.many("SELECT * FROM docs ORDER BY rowid ASC")).map(rowToDoc);
  }
  async listDocsByKind(kind: string) {
    return (await this.many("SELECT * FROM docs WHERE kind = ? ORDER BY rowid ASC", kind)).map(
      rowToDoc,
    );
  }
  async getDoc(id: string) {
    const r = await this.one("SELECT * FROM docs WHERE id = ?", id);
    return r ? rowToDoc(r) : null;
  }
  async upsertDoc(doc: DocRecord) {
    await this.run(
      `INSERT INTO docs (id, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      doc.id,
      doc.kind,
      JSON.stringify(doc.data),
      doc.createdAt,
      doc.updatedAt,
    );
  }
  async deleteDoc(id: string) {
    return Number((await this.run("DELETE FROM docs WHERE id = ?", id)).changes) > 0;
  }

  /* --- convites de cadastro --- */
  async insertInvite(i: InviteRow) {
    await this.run(
      `INSERT INTO invites (code_hash, id, email, role, hint, created_by, created_by_name, created_at, expires_at, used_at, used_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      i.codeHash,
      i.id,
      i.email,
      i.role,
      i.hint,
      i.createdBy,
      i.createdByName,
      i.createdAt,
      i.expiresAt,
      i.usedAt,
      i.usedBy,
    );
  }
  async listInvites() {
    return (await this.many("SELECT * FROM invites ORDER BY created_at DESC")).map(rowToInvite);
  }
  async getInviteByHash(codeHash: string) {
    const r = await this.one("SELECT * FROM invites WHERE code_hash = ?", codeHash);
    return r ? rowToInvite(r) : null;
  }
  async markInviteUsed(codeHash: string, usedAt: string, usedBy: string) {
    await this.run(
      "UPDATE invites SET used_at = ?, used_by = ? WHERE code_hash = ?",
      usedAt,
      usedBy,
      codeHash,
    );
  }
  async deleteInvite(id: string) {
    return Number((await this.run("DELETE FROM invites WHERE id = ?", id)).changes) > 0;
  }
}

/* ------------------------------------------------------------------ */
/* Drivers SQL: node:sqlite (arquivo/memória) e Cloudflare D1          */
/* ------------------------------------------------------------------ */

type AsyncExec = (sql: string) => Promise<void>;

/** Cria tabelas e índices, além das migrações aditivas, via `exec` async. */
async function ensureSqliteSchema(exec: AsyncExec, opts?: { skipPragmas?: boolean }) {
  if (!opts?.skipPragmas) {
    await exec("PRAGMA journal_mode = WAL;");
    await exec("PRAGMA foreign_keys = ON;");
  }
  await exec(SCHEMA);
  for (const col of ["department TEXT", "bio TEXT"]) {
    try {
      await exec(`ALTER TABLE users ADD COLUMN ${col}`);
    } catch {
      void 0;
    }
  }
  for (const sql of [
    "ALTER TABLE controls ADD COLUMN role TEXT NOT NULL DEFAULT 'gestor'",
    "ALTER TABLE risks ADD COLUMN role TEXT NOT NULL DEFAULT 'gestor'",
  ]) {
    try {
      await exec(sql);
    } catch {
      void 0;
    }
  }
  try {
    await exec(
      "CREATE TABLE IF NOT EXISTS role_functions (" +
        "role TEXT NOT NULL, function_key TEXT NOT NULL, " +
        "description TEXT NOT NULL, PRIMARY KEY (role, function_key))",
    );
    await exec("CREATE INDEX IF NOT EXISTS role_functions_role_idx ON role_functions(role)");
  } catch {
    void 0;
  }
  try {
    await exec(
      "CREATE TABLE IF NOT EXISTS user_functions (" +
        "user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, " +
        "function_key TEXT NOT NULL, description TEXT NOT NULL, " +
        "granted_at TEXT NOT NULL, granted_by TEXT, " +
        "PRIMARY KEY (user_id, function_key))",
    );
    await exec("CREATE INDEX IF NOT EXISTS user_functions_user_idx ON user_functions(user_id)");
  } catch {
    void 0;
  }
}

/** SQLite embutido do Node (`node:sqlite`), em arquivo persistente ou memória. */
export class SqliteStorage extends SqliteBackend {
  readonly kind = "sqlite" as const;

  private constructor(private db: SqlDatabase) {
    super();
  }

  static async open(path: string): Promise<SqliteStorage | null> {
    try {
      if (path !== ":memory:") {
        const { mkdirSync } = await import("node:fs");
        const nodePath = await import("node:path");
        const dir = nodePath.dirname(path);
        if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
      }
      let DatabaseSyncImpl: (new (path: string, opts?: object) => SqlDatabase) | undefined;
      try {
        const mod = (await import("node:sqlite")) as unknown as {
          DatabaseSync?: new (path: string, opts?: object) => SqlDatabase;
        };
        if (mod && typeof mod.DatabaseSync === "function") {
          DatabaseSyncImpl = mod.DatabaseSync;
        }
      } catch {
        // ignore
      }

      if (typeof DatabaseSyncImpl !== "function") {
        try {
          const { createRequire } = await import("node:module");
          const req = createRequire(
            typeof process !== "undefined" && process.cwd
              ? `${process.cwd()}/index.js`
              : "file:///",
          );
          const nativeSqlite = req("node:sqlite") as {
            DatabaseSync?: new (path: string, opts?: object) => SqlDatabase;
          };
          if (typeof nativeSqlite?.DatabaseSync === "function") {
            DatabaseSyncImpl = nativeSqlite.DatabaseSync;
          }
        } catch {
          // ignore
        }
      }

      if (typeof DatabaseSyncImpl !== "function") {
        SqliteBackend.lastOpenError = "node:sqlite DatabaseSync não suportado neste runtime";
        return null;
      }
      const db = new DatabaseSyncImpl(path);
      const storage = new SqliteStorage(db);
      await ensureSqliteSchema((sql) => storage.exec(sql));
      SqliteBackend.lastOpenError = null;
      return storage;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      SqliteBackend.lastOpenError = message;
      console.error(`[portal] Falha ao abrir SQLite em ${path}: ${message}`);
      return null;
    }
  }

  protected async one(sql: string, ...params: SqlValue[]) {
    return this.db.prepare(sql).get(...params);
  }
  protected async many(sql: string, ...params: SqlValue[]) {
    return this.db.prepare(sql).all(...params);
  }
  protected async run(sql: string, ...params: SqlValue[]) {
    const r = this.db.prepare(sql).run(...params);
    return { changes: Number(r.changes) };
  }
  protected async exec(sql: string) {
    this.db.exec(sql);
  }
}

type D1ValueLike = string | number | ArrayBuffer | null;

function toD1Params(params: SqlValue[]): D1ValueLike[] {
  return params.map((p) =>
    typeof p === "bigint" ? Number(p) : p instanceof Uint8Array ? (p.buffer as ArrayBuffer) : p,
  );
}

/** Driver "dormente" sobre o binding Cloudflare D1 (precisa da flag STORAGE_D1). */
export class D1Storage extends SqliteBackend {
  readonly kind = "d1" as const;

  private constructor(
    private db: D1DatabaseLike,
    private bindingName: string,
  ) {
    super();
  }

  /** Ativa o storage sobre um binding D1 válido, criando o schema se necessário. */
  static async open(binding: D1DatabaseLike, name: string): Promise<D1Storage | null> {
    try {
      const storage = new D1Storage(binding, name);
      await ensureSqliteSchema((sql) => storage.exec(sql), { skipPragmas: true });
      SqliteBackend.lastOpenError = null;
      return storage;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      SqliteBackend.lastOpenError = message;
      console.error(`[portal] Falha ao inicializar D1Storage("${name}"): ${message}`);
      return null;
    }
  }

  protected async one(sql: string, ...params: SqlValue[]) {
    const row = await this.db
      .prepare(sql)
      .bind(...toD1Params(params))
      .first();
    return row ?? undefined;
  }
  protected async many(sql: string, ...params: SqlValue[]) {
    const res = await this.db
      .prepare(sql)
      .bind(...toD1Params(params))
      .all();
    return (res?.results ?? []) as Record<string, SqlValue>[];
  }
  protected async run(sql: string, ...params: SqlValue[]) {
    const res = await this.db
      .prepare(sql)
      .bind(...toD1Params(params))
      .run();
    return { changes: Number(res?.meta?.changes ?? 0) };
  }
  protected async exec(sql: string) {
    await this.db.exec(sql);
  }

  override async getStorageInfo(): Promise<StorageInfo> {
    return {
      kind: this.kind,
      persistent: true,
      path: `d1:${this.bindingName}`,
      lastBackupAt: await this.getMeta("last_backup_at"),
      requirePersistent: isRequirePersistent(),
    };
  }
}

interface D1PreparedLike {
  bind(...params: D1ValueLike[]): D1PreparedLike;
  all(): Promise<{ results?: Record<string, SqlValue>[] }>;
  first(): Promise<Record<string, SqlValue> | null | undefined>;
  run(): Promise<{ meta?: { changes?: number; last_row_id?: number } }>;
}

export interface D1DatabaseLike {
  exec(sql: string): Promise<unknown>;
  prepare(sql: string): D1PreparedLike;
}

/** Resgata o binding D1 do runtime edge (Workers/Nitro) quando injetado via `setD1Binding`. */
function resolveD1Binding(): { db: D1DatabaseLike; name: string } | null {
  if (!d1Binding) return null;
  return { db: d1Binding, name: d1BindingName };
}

function safeJsonObject(v: SqlValue | undefined): JsonObject {
  if (typeof v !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(v);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
}

function rowToDoc(r: Record<string, SqlValue>): DocRecord {
  return {
    id: str(r["id"]),
    kind: str(r["kind"]),
    data: safeJsonObject(r["data"]),
    createdAt: str(r["created_at"]),
    updatedAt: str(r["updated_at"]),
  };
}

function rowToInvite(r: Record<string, SqlValue>): InviteRow {
  return {
    id: str(r["id"]),
    codeHash: str(r["code_hash"]),
    email: str(r["email"]),
    role: str(r["role"]) as Role,
    hint: str(r["hint"]),
    createdBy: nul(r["created_by"]),
    createdByName: str(r["created_by_name"]),
    createdAt: str(r["created_at"]),
    expiresAt: str(r["expires_at"]),
    usedAt: nul(r["used_at"]),
    usedBy: nul(r["used_by"]),
  };
}

function safeTags(v: SqlValue | undefined): string[] {
  if (typeof v !== "string") return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function safeJson<T>(v: SqlValue | undefined, fallback: T): T {
  if (typeof v !== "string") return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Driver em memória                                                   */
/* ------------------------------------------------------------------ */

export class MemoryStorage implements Storage {
  readonly kind = "memory" as const;

  private users: UserRow[] = [];
  private sessions: SessionRow[] = [];
  private columns: string[] = [];
  private tasks: Task[] = [];
  private comments: CommentRecord[] = [];
  private controls: ComplianceControl[] = [];
  private evidences: EvidenceRecord[] = [];
  private audit: AuditEntry[] = [];
  private modules: Module[] = [];
  private risks: Risk[] = [];
  private wiki: WikiArticle[] = [];
  private milestones: Milestone[] = [];
  private releases: Release[] = [];
  private patentStages: PatentStage[] = [];
  private techStack: TechItem[] = [];
  private automationShares: AutomationShare[] = [];
  private nextSteps: NextStep[] = [];
  private legalDocs: LegalDoc[] = [];
  private resetTokens: ResetToken[] = [];
  private meta = new Map<string, string>();
  private docs: DocRecord[] = [];
  private invites: InviteRow[] = [];
  private roleFunctions: RoleFunctionRow[] = [];
  private userFunctions: UserFunctionRow[] = [];

  async countUsers() {
    return this.users.length;
  }
  async getUserByEmail(email: string) {
    const target = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === target) ?? null;
  }
  async getUserById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async listUsers() {
    return [...this.users];
  }
  async listRoleFunctions(role: Role): Promise<RoleFunctionRow[]> {
    return this.roleFunctions.filter((f) => f.role === role);
  }
  async listAllRoleFunctions(): Promise<RoleFunctionRow[]> {
    return [...this.roleFunctions];
  }
  async syncRoleFunctions(
    role: Role,
    functions: Array<{ key: string; description: string }>,
  ): Promise<void> {
    this.roleFunctions = this.roleFunctions.filter((f) => f.role !== role);
    for (const f of functions) {
      this.roleFunctions.push({ role, functionKey: f.key, description: f.description });
    }
  }
  async deleteRoleFunctions(role: Role): Promise<void> {
    this.roleFunctions = this.roleFunctions.filter((f) => f.role !== role);
  }
  async listUserFunctions(userId: string): Promise<UserFunctionRow[]> {
    return this.userFunctions.filter((f) => f.userId === userId);
  }
  async grantUserFunction(
    userId: string,
    functionKey: string,
    description: string,
    grantedBy: string | null,
    grantedAt = new Date().toISOString(),
  ): Promise<boolean> {
    if (this.userFunctions.some((f) => f.userId === userId && f.functionKey === functionKey)) {
      return false;
    }
    this.userFunctions.push({
      userId,
      functionKey,
      description,
      grantedAt,
      grantedBy,
    });
    return true;
  }
  async revokeUserFunction(userId: string, functionKey: string): Promise<boolean> {
    const before = this.userFunctions.length;
    this.userFunctions = this.userFunctions.filter(
      (f) => !(f.userId === userId && f.functionKey === functionKey),
    );
    return this.userFunctions.length < before;
  }
  async insertUser(u: UserRow) {
    this.users.push(u);
  }
  async updateUser(
    id: string,
    patch: Partial<Pick<UserRow, "role" | "name" | "jobTitle" | "department" | "bio">>,
  ) {
    this.users = this.users.map((u) => (u.id === id ? { ...u, ...patch } : u));
  }
  async deleteUser(id: string) {
    this.users = this.users.filter((u) => u.id !== id);
    this.sessions = this.sessions.filter((s) => s.userId !== id);
    this.userFunctions = this.userFunctions.filter((f) => f.userId !== id);
  }
  async clearAllUsers() {
    const n = this.users.length;
    this.users = [];
    this.sessions = [];
    this.userFunctions = [];
    return n;
  }

  async getSessionByTokenHash(tokenHash: string) {
    return this.sessions.find((s) => s.tokenHash === tokenHash) ?? null;
  }
  async insertSession(s: SessionRow) {
    this.sessions.push(s);
  }
  async deleteSession(tokenHash: string) {
    this.sessions = this.sessions.filter((s) => s.tokenHash !== tokenHash);
  }
  async deleteSessionsForUser(userId: string) {
    this.sessions = this.sessions.filter((s) => s.userId !== userId);
  }
  async purgeExpiredSessions(nowIso: string) {
    this.sessions = this.sessions.filter((s) => s.expiresAt >= nowIso);
  }

  async listColumns() {
    return [...this.columns];
  }
  async insertColumn(name: string) {
    if (this.columns.includes(name)) return false;
    this.columns.push(name);
    return true;
  }
  async deleteColumn(name: string) {
    if ((await this.countTasksInColumn(name)) > 0) return false;
    const before = this.columns.length;
    this.columns = this.columns.filter((c) => c !== name);
    return this.columns.length < before;
  }
  async countTasksInColumn(name: string) {
    return this.tasks.filter((t) => t.column === name).length;
  }

  async listTasks() {
    return [...this.tasks];
  }
  async getTask(id: string) {
    return this.tasks.find((t) => t.id === id) ?? null;
  }
  async insertTask(t: Task) {
    this.tasks.unshift(t);
  }
  async updateTaskColumn(id: string, column: string) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    task.column = column;
    return task;
  }
  async deleteTask(id: string) {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    return this.tasks.length < before;
  }

  async listComments() {
    return [...this.comments];
  }
  async insertComment(c: CommentRecord) {
    this.comments.push(c);
  }

  async listControls() {
    return this.controls.map((c) => ({
      ...c,
      role: (c.role ?? "gestor") as ComplianceControl["role"],
    }));
  }
  async getControl(id: string) {
    const c = this.controls.find((c) => c.id === id) ?? null;
    return c ? { ...c, role: (c.role ?? "gestor") as ComplianceControl["role"] } : null;
  }
  async insertControl(c: ComplianceControl) {
    if (!this.controls.some((x) => x.id === c.id))
      this.controls.push({ ...c, role: c.role ?? "gestor" });
  }
  async reviewControl(
    id: string,
    patch: Pick<ComplianceControl, "status" | "tone" | "lastReview" | "nextReview" | "overdue">,
  ) {
    const control = this.controls.find((c) => c.id === id);
    if (!control) return;
    Object.assign(control, patch);
  }
  async deleteControl(id: string) {
    const before = this.controls.length;
    this.controls = this.controls.filter((c) => c.id !== id);
    return this.controls.length < before;
  }

  async listEvidences() {
    return [...this.evidences];
  }
  async getEvidence(id: string) {
    return this.evidences.find((e) => e.id === id) ?? null;
  }
  async insertEvidence(e: EvidenceRecord) {
    this.evidences.unshift({ ...e });
  }
  async reviewEvidence(
    id: string,
    patch: Pick<EvidenceRecord, "status" | "reviewerName" | "reviewedAt" | "note">,
  ) {
    const evidence = this.evidences.find((e) => e.id === id);
    if (!evidence) return;
    Object.assign(evidence, patch);
  }

  async insertAudit(a: AuditEntry) {
    this.audit.unshift({ ...a });
  }
  async listAudit() {
    return [...this.audit];
  }
  async countAudit() {
    return this.audit.length;
  }

  async listModules() {
    return [...this.modules];
  }
  async insertModule(m: Module) {
    if (!this.modules.some((x) => x.id === m.id)) this.modules.push(m);
  }
  async deleteModule(id: string) {
    const before = this.modules.length;
    this.modules = this.modules.filter((m) => m.id !== id);
    return this.modules.length < before;
  }

  async listRisks() {
    return this.risks.map((r) => ({
      ...r,
      role: (r.role ?? "gestor") as Risk["role"],
    }));
  }
  async getRisk(id: string) {
    const r = this.risks.find((r) => r.id === id) ?? null;
    return r ? { ...r, role: (r.role ?? "gestor") as Risk["role"] } : null;
  }
  async insertRisk(r: Risk) {
    if (!this.risks.some((x) => x.id === r.id)) this.risks.push({ ...r, role: r.role ?? "gestor" });
  }
  async updateRisk(id: string, patch: Partial<Risk>) {
    const cur = this.risks.find((r) => r.id === id);
    if (!cur) return null;
    Object.assign(cur, patch);
    return cur;
  }
  async deleteRisk(id: string) {
    const before = this.risks.length;
    this.risks = this.risks.filter((r) => r.id !== id);
    return this.risks.length < before;
  }

  async listWiki() {
    return [...this.wiki];
  }
  async getWiki(slug: string) {
    return this.wiki.find((w) => w.slug === slug) ?? null;
  }
  async insertWiki(a: WikiArticle) {
    if (!this.wiki.some((x) => x.slug === a.slug))
      this.wiki.push({ ...a, sections: [...a.sections] });
  }
  async updateWiki(slug: string, patch: Partial<WikiArticle>) {
    const cur = this.wiki.find((w) => w.slug === slug);
    if (!cur) return null;
    Object.assign(cur, patch);
    return cur;
  }
  async deleteWiki(slug: string) {
    const before = this.wiki.length;
    this.wiki = this.wiki.filter((w) => w.slug !== slug);
    return this.wiki.length < before;
  }

  async listMilestones() {
    return [...this.milestones];
  }
  async insertMilestone(m: Milestone) {
    if (!this.milestones.some((x) => x.id === m.id)) this.milestones.push({ ...m });
  }
  async deleteMilestone(id: string) {
    const before = this.milestones.length;
    this.milestones = this.milestones.filter((m) => m.id !== id);
    return this.milestones.length < before;
  }

  async listReleases() {
    return [...this.releases];
  }
  async insertRelease(r: Release) {
    if (!this.releases.some((x) => x.version === r.version))
      this.releases.push({ ...r, items: [...r.items] });
  }
  async deleteRelease(version: string) {
    const before = this.releases.length;
    this.releases = this.releases.filter((r) => r.version !== version);
    return this.releases.length < before;
  }

  async listPatentStages() {
    return [...this.patentStages];
  }
  async getPatentStage(id: string) {
    return this.patentStages.find((s) => s.id === id) ?? null;
  }
  async insertPatentStage(s: PatentStage) {
    if (!this.patentStages.some((x) => x.id === s.id)) this.patentStages.push({ ...s });
  }
  async updatePatentStage(id: string, patch: Partial<PatentStage>) {
    const cur = this.patentStages.find((s) => s.id === id);
    if (!cur) return null;
    Object.assign(cur, patch);
    return cur;
  }

  async listTechStack() {
    return [...this.techStack];
  }
  async insertTechStack(item: TechItem) {
    if (!this.techStack.some((x) => x.name === item.name)) this.techStack.push({ ...item });
  }
  async deleteTechStack(name: string) {
    const before = this.techStack.length;
    this.techStack = this.techStack.filter((t) => t.name !== name);
    return this.techStack.length < before;
  }

  async getMeta(key: string) {
    return this.meta.get(key) ?? null;
  }
  async setMeta(key: string, value: string) {
    this.meta.set(key, value);
  }

  async listAutomationShares() {
    return [...this.automationShares];
  }
  async getAutomationShare(id: string) {
    return this.automationShares.find((s) => s.id === id) ?? null;
  }
  async getAutomationShareByWorkflow(workflowId: string) {
    return this.automationShares.find((s) => s.workflowId === workflowId) ?? null;
  }
  async upsertAutomationShare(s: AutomationShare) {
    const idx = this.automationShares.findIndex((x) => x.workflowId === s.workflowId);
    if (idx >= 0) this.automationShares[idx] = { ...s };
    else this.automationShares.push({ ...s });
  }
  async deleteAutomationShare(id: string) {
    const before = this.automationShares.length;
    this.automationShares = this.automationShares.filter((s) => s.id !== id);
    return this.automationShares.length < before;
  }

  async listNextSteps() {
    return [...this.nextSteps].sort((a, b) => a.position - b.position);
  }
  async getNextStep(id: string) {
    return this.nextSteps.find((s) => s.id === id) ?? null;
  }
  async insertNextStep(s: NextStep) {
    if (!this.nextSteps.some((x) => x.id === s.id)) this.nextSteps.push({ ...s });
  }
  async updateNextStep(id: string, patch: Partial<NextStep>) {
    const cur = this.nextSteps.find((s) => s.id === id);
    if (!cur) return null;
    Object.assign(cur, patch);
    return cur;
  }
  async deleteNextStep(id: string) {
    const before = this.nextSteps.length;
    this.nextSteps = this.nextSteps.filter((s) => s.id !== id);
    return this.nextSteps.length < before;
  }
  async reorderNextSteps(orderedIds: string[]) {
    const map = new Map(this.nextSteps.map((s) => [s.id, s]));
    this.nextSteps = orderedIds
      .map((id, idx) => {
        const s = map.get(id);
        if (s) s.position = idx;
        return s!;
      })
      .filter(Boolean);
  }

  async listLegalDocs() {
    const latest = new Map<string, LegalDoc>();
    for (const d of [...this.legalDocs].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt),
    )) {
      if (!latest.has(d.slug)) latest.set(d.slug, d);
    }
    return Array.from(latest.values());
  }
  async getLegalDoc(slug: string) {
    const docs = this.legalDocs
      .filter((d) => d.slug === slug)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return docs[0] ?? null;
  }
  async getLegalDocById(id: string) {
    return this.legalDocs.find((d) => d.id === id) ?? null;
  }
  async listLegalDocVersions(slug: string) {
    return this.legalDocs
      .filter((d) => d.slug === slug)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }
  async insertLegalDoc(doc: LegalDoc) {
    this.legalDocs.push({ ...doc, clauses: [...doc.clauses] });
  }

  async listResetTokens() {
    return [...this.resetTokens];
  }
  async getResetTokenByHash(tokenHash: string) {
    return this.resetTokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async insertResetToken(t: ResetToken) {
    this.resetTokens.push({ ...t });
  }
  async markResetTokenUsed(tokenHash: string, usedAt: string) {
    const tok = this.resetTokens.find((t) => t.tokenHash === tokenHash);
    if (tok) tok.usedAt = usedAt;
  }
  async deleteExpiredResetTokens(nowIso: string) {
    this.resetTokens = this.resetTokens.filter((t) => t.expiresAt >= nowIso || t.usedAt !== null);
  }

  async listSessionsForUser(userId: string) {
    return this.sessions.filter((s) => s.userId === userId);
  }
  async exportDatabase(): Promise<DatabaseDump> {
    return {
      exportedAt: new Date().toISOString(),
      users: [...this.users],
      sessions: [...this.sessions],
      columns: [...this.columns],
      tasks: [...this.tasks],
      comments: [...this.comments],
      controls: [...this.controls],
      evidences: [...this.evidences],
      audit: [...this.audit],
      modules: [...this.modules],
      risks: [...this.risks],
      wiki: [...this.wiki],
      milestones: [...this.milestones],
      releases: [...this.releases],
      patentStages: [...this.patentStages],
      techStack: [...this.techStack],
      automationShares: [...this.automationShares],
      nextSteps: [...this.nextSteps],
      legalDocs: [...this.legalDocs],
      resetTokens: [...this.resetTokens],
      meta: Object.fromEntries(this.meta),
      userFunctions: [...this.userFunctions],
    };
  }
  async importDatabase(dump: DatabaseDump): Promise<void> {
    this.users = [...(dump.users ?? [])];
    this.sessions = [...(dump.sessions ?? [])];
    this.columns = [...(dump.columns ?? [])];
    this.tasks = [...(dump.tasks ?? [])];
    this.comments = [...(dump.comments ?? [])];
    this.controls = [...(dump.controls ?? [])];
    this.evidences = [...(dump.evidences ?? [])];
    this.audit = [...(dump.audit ?? [])];
    this.modules = [...(dump.modules ?? [])];
    this.risks = [...(dump.risks ?? [])];
    this.wiki = [...(dump.wiki ?? [])];
    this.milestones = [...(dump.milestones ?? [])];
    this.releases = [...(dump.releases ?? [])];
    this.patentStages = [...(dump.patentStages ?? [])];
    this.techStack = [...(dump.techStack ?? [])];
    this.automationShares = [...(dump.automationShares ?? [])];
    this.nextSteps = [...(dump.nextSteps ?? [])];
    this.legalDocs = [...(dump.legalDocs ?? [])];
    this.resetTokens = [...(dump.resetTokens ?? [])];
    this.userFunctions = [...(dump.userFunctions ?? [])];
    this.meta = new Map(Object.entries(dump.meta ?? {}));
  }
  async getStorageInfo(): Promise<StorageInfo> {
    return {
      kind: this.kind,
      persistent: false,
      path: resolveDatabasePath(),
      lastBackupAt: this.meta.get("last_backup_at") ?? null,
      requirePersistent: isRequirePersistent(),
    };
  }
  async listDocs() {
    return this.docs.map((d) => ({ ...d }));
  }
  async listDocsByKind(kind: string) {
    return this.docs.filter((d) => d.kind === kind).map((d) => ({ ...d }));
  }
  async getDoc(id: string) {
    return this.docs.find((d) => d.id === id) ?? null;
  }
  async upsertDoc(doc: DocRecord) {
    const idx = this.docs.findIndex((d) => d.id === doc.id);
    if (idx >= 0) this.docs[idx] = doc;
    else this.docs.push(doc);
  }
  async deleteDoc(id: string) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => d.id !== id);
    return this.docs.length < before;
  }

  async insertInvite(i: InviteRow) {
    this.invites.push(i);
  }
  async listInvites() {
    return [...this.invites].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getInviteByHash(codeHash: string) {
    return this.invites.find((i) => i.codeHash === codeHash) ?? null;
  }
  async markInviteUsed(codeHash: string, usedAt: string, usedBy: string) {
    this.invites = this.invites.map((i) =>
      i.codeHash === codeHash ? { ...i, usedAt, usedBy } : i,
    );
  }
  async deleteInvite(id: string) {
    const before = this.invites.length;
    this.invites = this.invites.filter((i) => i.id !== id);
    return this.invites.length < before;
  }
}

/* ------------------------------------------------------------------ */
/* Semente inicial + inicialização                                     */
/* ------------------------------------------------------------------ */

async function seedIfEmpty(storage: Storage): Promise<void> {
  const [
    { kanbanColumns },
    { modules, nextSteps },
    { patentStages },
    { wikiArticles },
    { termsDoc, lgpdDoc },
  ] = await Promise.all([
    import("@/data/tasks"),
    import("@/data/modules"),
    import("@/data/patent"),
    import("@/data/wiki"),
    import("@/data/legal"),
  ]);
  if ((await storage.listColumns()).length === 0) {
    for (const name of kanbanColumns) await storage.insertColumn(name);
  }
  if ((await storage.listControls()).length === 0) {
    const { controls } = await import("@/data/compliance");
    for (const c of controls) await storage.insertControl(c);
  }
  if ((await storage.listModules()).length === 0) {
    for (const m of modules) await storage.insertModule({ ...m, date: isoFromBrOrText(m.date) });
  }
  if ((await storage.listPatentStages()).length === 0) {
    for (const p of patentStages)
      await storage.insertPatentStage({
        ...p,
        deadline: isoFromBrOrText(p.deadline),
      });
  }
  if ((await storage.listWiki()).length === 0) {
    for (const w of wikiArticles) await storage.insertWiki(w);
  }
  if ((await storage.listNextSteps()).length === 0) {
    for (let i = 0; i < nextSteps.length; i++) {
      const s = nextSteps[i]!;
      await storage.insertNextStep({
        id: `ns_${i + 1}`,
        title: s.title,
        due: isoFromBrOrText(s.due),
        status: "pendente",
        position: i,
        createdAt: new Date().toISOString(),
      });
    }
  }
  if ((await storage.listLegalDocs()).length === 0) {
    const now = new Date().toISOString();
    const docs: Array<{ slug: string; doc: typeof termsDoc }> = [
      { slug: "termos", doc: termsDoc },
      { slug: "lgpd", doc: lgpdDoc },
    ];
    for (const { slug, doc: d } of docs) {
      await storage.insertLegalDoc({
        id: `ld_${slug}_${d.version}`,
        slug,
        title: d.title,
        subtitle: d.subtitle ?? "",
        version: d.version,
        intro: d.intro ?? "",
        clauses: d.clauses,
        publishedAt: isoFromBrOrText(d.updatedAt),
        createdAt: now,
        updatedAt: now,
        createdById: null,
      });
    }
  }
  if ((await storage.listAllRoleFunctions()).length === 0) {
    const { roleFunctionsData } = await import("@/lib/rbac");
    for (const role of Object.keys(roleFunctionsData) as Role[]) {
      await storage.syncRoleFunctions(
        role,
        roleFunctionsData[role].map((f) => ({
          key: f.key,
          description: f.description,
        })),
      );
    }
  }
  await seedDocsIfEmpty(storage);
  await purgeDemoData(storage);
}

function isoFromBrOrText(v: string): string {
  if (!v || v === "A definir") return new Date().toISOString().slice(0, 10);
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const months: Record<string, string> = {
    Jan: "01",
    Fev: "02",
    Mar: "03",
    Abr: "04",
    Mai: "05",
    Jun: "06",
    Jul: "07",
    Ago: "08",
    Set: "09",
    Out: "10",
    Nov: "11",
    Dez: "12",
  };
  const m = v.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/);
  if (m && months[m[2]!]) return `${m[3]}-${months[m[2]!]}-${m[1]!.padStart(2, "0")}`;
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/**
 * Popula os módulos de referência (riscos, engenharia, patente, wiki) na primeira
 * execução. Tarefas, marcos e releases NÃO são semeados: são cadastrados no portal.
 */
async function seedDocsIfEmpty(storage: Storage): Promise<void> {
  if ((await storage.listDocs()).length > 0) return;
  const [{ risks }, { stack }, { patentStages }, { wikiArticles }] = await Promise.all([
    import("@/data/risks"),
    import("@/data/team"),
    import("@/data/patent"),
    import("@/data/wiki"),
  ]);
  const now = new Date().toISOString();
  let n = 0;
  const put = async (kind: string, data: JsonObject) => {
    n += 1;
    await storage.upsertDoc({
      id: `seed_${kind}_${n}`,
      kind,
      data,
      createdAt: now,
      updatedAt: now,
    });
  };
  for (const r of risks) {
    const { id: _id, ...rest } = r;
    await put("risk", { ...rest });
  }
  for (const t of stack) await put("tech", { ...t });
  for (const s of patentStages) {
    const { id: _id, ...rest } = {
      ...s,
      deadline: isoFromBrOrText(s.deadline),
    };
    await put("patent", { ...rest });
  }
  for (const a of wikiArticles) await put("wiki", { ...a });
}

/**
 * Limpeza única de bancos criados antes desta versão: remove as tarefas e os
 * marcos/releases de demonstração para que o portal comece limpo, sem apagar
 * nada que tenha sido cadastrado pelos usuários.
 */
async function purgeDemoData(storage: Storage): Promise<void> {
  const FLAG = "demo_purge_v2";
  if (await storage.getMeta(FLAG)) return;

  const { tasks: demoTasks } = await import("@/data/tasks");
  const demoIds = new Set(demoTasks.map((t) => t.id));
  for (const task of await storage.listTasks()) {
    if (demoIds.has(task.id)) await storage.deleteTask(task.id);
  }

  const legacyModuleIds = new Set([
    "crm",
    "fiscal",
    "financeiro",
    "faturamento",
    "compras",
    "estoque",
    "ged",
  ]);
  for (const m of await storage.listModules()) {
    if (legacyModuleIds.has(m.id)) await storage.deleteModule(m.id);
  }

  for (const doc of await storage.listDocs()) {
    if (doc.id.startsWith("seed_milestone_") || doc.id.startsWith("seed_release_")) {
      await storage.deleteDoc(doc.id);
    }
  }
  await storage.setMeta(FLAG, new Date().toISOString());
}

let storagePromise: Promise<Storage> | undefined;
let activePersistent = false;

/** Indica se o storage atual persiste em disco (SQLite em arquivo). Falso no modo em memória. */
export function isStoragePersistent(): boolean {
  return activePersistent;
}

/** Binding D1 injetado pelo runtime por-request (via `setD1Binding`), ou `null`. */
let d1Binding: D1DatabaseLike | undefined;
/** Nome da binding D1 injetada (para exibição em caminhos/diagnóstico). */
let d1BindingName = "DB";

/** Injeta o binding D1 do runtime edge para que `initStorage()` o utilize.
 *  Chamado pelo handler `fetch` antes de qualquer servidor fn roda.
 *  `name` é o nome declaro da binding (ex.: "DB"). */
export function setD1Binding(binding: D1DatabaseLike, name?: string) {
  d1Binding = binding;
  d1BindingName = name ?? "DB";
}

/** Retorna o binding D1 injetado, ou `null` se nenhum estiver configurado. */
export function getD1Binding(): D1DatabaseLike | undefined {
  return d1Binding;
}

/** Torna o caminho absoluto sem usar `import.meta.url` (inválido no runtime edge). */
function toAbsolute(p: string): string {
  if (p === ":memory:" || p.startsWith("/")) return p;
  const cwd = typeof process !== "undefined" && process.cwd ? process.cwd() : "";
  return cwd ? `${cwd.replace(/\/$/, "")}/${p.replace(/^\.\//, "")}` : p;
}

function resolveDatabasePath(): string {
  const fromEnv =
    typeof process !== "undefined" && process.env
      ? (process.env["DATABASE_PATH"] ?? "").trim()
      : "";
  // Nunca use `import.meta.url` aqui: no runtime edge (workerd) ele pode não ser
  // uma URL válida e `new URL(...)` lança "Invalid URL string.", derrubando o SSR.
  if (fromEnv.length > 0) return toAbsolute(fromEnv);
  return activeDatabasePath ?? toAbsolute(".data/portal.db");
}

/** Caminho realmente aberto pelo storage (preenchido em `initStorage`). */
let activeDatabasePath: string | null = null;

export function getActiveDatabasePath(): string | null {
  return activeDatabasePath;
}

/** Candidatos persistentes, em ordem de preferência. */
function candidateDatabasePaths(): string[] {
  const fromEnv =
    typeof process !== "undefined" && process.env
      ? (process.env["DATABASE_PATH"] ?? "").trim()
      : "";
  const list: string[] = [];
  if (fromEnv.length > 0) list.push(toAbsolute(fromEnv));
  if (fromEnv !== ":memory:") {
    list.push(toAbsolute(".data/portal.db"));
    list.push("/tmp/portal.db");
  }
  return list.filter((p, i) => p !== ":memory:" && list.indexOf(p) === i);
}

export function isRequirePersistent(): boolean {
  const v =
    typeof process !== "undefined" && process.env
      ? (process.env["STORAGE_REQUIRE_PERSISTENT"] ?? process.env["REQUIRE_PERSISTENT_DB"] ?? "")
          .trim()
          .toLowerCase()
      : "";
  return v === "1" || v === "true" || v === "yes";
}

let storageInitError: string | null = null;
export function getStorageInitError(): string | null {
  return storageInitError;
}

/**
 * Retorna o storage do processo:
 * 1. SQLite em arquivo (persistente) quando DATABASE_PATH abre com sucesso;
 * 2. D1 (binding D1 injetado) quando disponível;
 * 3. SQLite em memória quando há node:sqlite mas não FS gravável;
 * 4. Driver JS em memória como último recurso.
 * Tarefas, marcos e releases começam vazios: são cadastrados pelos usuários.
 *
 * Se um binding D1 for injetado APÓS a primeira inicialização (modo memória),
 * esta função re-inicializa com o D1 na próxima chamada.
 */
export async function getStorage(): Promise<Storage> {
  const prev = storagePromise ? await storagePromise : undefined;
  if (prev && activeDatabasePath !== ":memory:") return prev;
  if (prev && activeDatabasePath === ":memory:" && resolveD1Binding()) {
    storagePromise = initStorage();
    return storagePromise;
  }
  storagePromise ??= initStorage();
  return storagePromise;
}

async function initStorage(): Promise<Storage> {
  const requirePersistent = isRequirePersistent();

  // 0) Neon/Postgres — persiste na Vercel (Vercel Postgres / Neon)
  const postgresUrl =
    typeof process !== "undefined" && process.env
      ? (
          process.env["POSTGRES_URL"] ??
          process.env["POSTGRES_PRISMA_URL"] ??
          process.env["DATABASE_URL"] ??
          process.env["POSTGRES_URL_NON_POOLING"] ??
          ""
        ).trim()
      : "";
  const isPostgres = postgresUrl.startsWith("postgres://") || postgresUrl.startsWith("postgresql://");
  if (isPostgres) {
    console.info(`[portal] Tentando PostgresStorage (Neon)`);
    try {
      const { PostgresStorage } = await import("./postgres-storage");
      const pgStore = await PostgresStorage.open(postgresUrl);
      if (pgStore) {
        await seedIfEmpty(pgStore);
        activePersistent = true;
        activeDatabasePath = `postgres:${postgresUrl.split("@").pop()?.split("?")[0] ?? "neon"}`;
        storageInitError = null;
        console.info(`[portal] PostgresStorage ativo (Neon)`);
        return pgStore;
      }
      const err = PostgresStorage.lastOpenError ?? "erro desconhecido";
      if (requirePersistent) {
        storageInitError = `STORAGE_REQUIRE_PERSISTENT=1 e Postgres falhou — ${err}`;
        console.error(`[portal] ${storageInitError}`);
        throw new Error(storageInitError);
      }
      console.warn(`[portal] Postgres falhou: ${err}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[portal] PostgresStorage erro import/open: ${msg}`);
      if (requirePersistent) throw e;
    }
  }

  // 0b) Turso/libSQL remoto — alternativa SQLite na nuvem
  const tursoUrl =
    typeof process !== "undefined" && process.env
      ? (
          process.env["TURSO_DATABASE_URL"] ??
          process.env["LIBSQL_URL"] ??
          (process.env["DATABASE_URL"]?.startsWith("libsql://") ? process.env["DATABASE_URL"] : "") ??
          ""
        ).trim()
      : "";
  if (tursoUrl) {
    const tursoToken =
      typeof process !== "undefined" && process.env
        ? (process.env["TURSO_AUTH_TOKEN"] ?? process.env["LIBSQL_AUTH_TOKEN"] ?? "").trim()
        : "";
    console.info(`[portal] Tentando TursoStorage em ${tursoUrl}`);
    try {
      const { TursoStorage } = await import("./turso-storage");
      const turso = await TursoStorage.open(tursoUrl, tursoToken || undefined);
      if (turso) {
        await seedIfEmpty(turso);
        activePersistent = true;
        activeDatabasePath = `turso:${tursoUrl}`;
        storageInitError = null;
        console.info(`[portal] TursoStorage ativo`);
        return turso;
      }
      const err = TursoStorage.lastOpenError ?? "erro desconhecido";
      if (requirePersistent) {
        storageInitError = `STORAGE_REQUIRE_PERSISTENT=1 e Turso falhou — ${err}`;
        console.error(`[portal] ${storageInitError}`);
        throw new Error(storageInitError);
      }
      console.warn(`[portal] Turso falhou: ${err}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[portal] TursoStorage erro import/open: ${msg}`);
      if (requirePersistent) throw e;
    }
  }

  const d1 = resolveD1Binding();
  if (d1) {
    console.info(`[portal] Tentando D1Storage (binding "${d1.name}")`);
    const d1Storage = await D1Storage.open(d1.db, d1.name);
    if (d1Storage) {
      await seedIfEmpty(d1Storage);
      activePersistent = true;
      activeDatabasePath = `d1:${d1.name}`;
      storageInitError = null;
      console.info(`[portal] D1Storage ativo (binding "${d1.name}")`);
      return d1Storage;
    }
    const err = `binding "${d1.name}" falhou ao inicializar: ${SqliteBackend.lastOpenError ?? "erro desconhecido"}`;
    if (requirePersistent) {
      storageInitError = `STORAGE_REQUIRE_PERSISTENT=1 e D1 indisponível — ${err}`;
      console.error(`[portal] ${storageInitError}`);
      throw new Error(storageInitError);
    }
    console.warn(`[portal] ${err}`);
  }

  const candidates = candidateDatabasePaths();
  const failures: string[] = [];

  for (const candidate of candidates) {
    console.info(`[portal] Tentando SQLite em ${candidate}`);
    const fileDb = await SqliteStorage.open(candidate);
    if (fileDb) {
      await seedIfEmpty(fileDb);
      activePersistent = true;
      activeDatabasePath = candidate;
      storageInitError = null;
      console.info(`[portal] SQLite persistente em ${candidate}`);
      return fileDb;
    }
    failures.push(`${candidate}: ${SqliteStorage.lastOpenError ?? "erro desconhecido"}`);
  }

  const cause =
    failures.length > 0
      ? failures.join(" | ")
      : "DATABASE_PATH=:memory: (nenhum caminho persistente configurado)";

  if (requirePersistent) {
    storageInitError = `STORAGE_REQUIRE_PERSISTENT=1 e nenhum caminho persistente pôde ser aberto — ${cause}`;
    console.error(`[portal] ${storageInitError}`);
    throw new Error(storageInitError);
  }

  const memorySqlite = await SqliteStorage.open(":memory:");
  if (memorySqlite) {
    await seedIfEmpty(memorySqlite);
    activePersistent = false;
    activeDatabasePath = ":memory:";
    storageInitError = `Armazenamento em memória (volátil): os dados serão perdidos a cada reinício. Causa: ${cause}. Configure DATABASE_PATH para um caminho gravável.`;
    console.warn(`[portal] ${storageInitError}`);
  }

  const fallback = new MemoryStorage();
  await seedIfEmpty(fallback);
  activePersistent = false;
  activeDatabasePath = ":memory:";
  storageInitError = `node:sqlite indisponível neste runtime: armazenamento em memória (não persistente). Detalhe: ${cause}`;
  console.warn(`[portal] ${storageInitError}`);

  return fallback;
}
