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
  readonly kind: "sqlite" | "memory";

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
  syncRoleFunctions(role: Role, functions: Array<{ key: string; description: string }>): Promise<void>;
  deleteRoleFunctions(role: Role): Promise<void>;

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
}

export interface StorageInfo {
  kind: "sqlite" | "memory";
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

const SCHEMA = `
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

export class SqliteStorage implements Storage {
  readonly kind = "sqlite" as const;

  private constructor(private db: SqlDatabase) {}

  /** Último erro real ocorrido em `open` (usado para diagnóstico na interface). */
  static lastOpenError: string | null = null;

  static async open(path: string): Promise<SqliteStorage | null> {
    try {
      if (path !== ":memory:") {
        const { mkdirSync } = await import("node:fs");
        const nodePath = await import("node:path");
        const dir = nodePath.dirname(path);
        if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
      }
      const mod = (await import("node:sqlite")) as unknown as {
        DatabaseSync: new (path: string, opts?: object) => SqlDatabase;
      };
      const db = new mod.DatabaseSync(path);

      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA foreign_keys = ON;");
      db.exec(SCHEMA);
      for (const col of ["department TEXT", "bio TEXT"]) {
        try {
          db.exec(`ALTER TABLE users ADD COLUMN ${col}`);
        } catch {
          void 0;
        }
      }
       for (const sql of [
         "ALTER TABLE controls ADD COLUMN role TEXT NOT NULL DEFAULT 'gestor'",
         "ALTER TABLE risks ADD COLUMN role TEXT NOT NULL DEFAULT 'gestor'",
       ]) {
         try {
           db.exec(sql);
         } catch {
           void 0;
         }
       }
       try {
         db.exec(
           "CREATE TABLE IF NOT EXISTS role_functions (" +
             "role TEXT NOT NULL, function_key TEXT NOT NULL, " +
             "description TEXT NOT NULL, PRIMARY KEY (role, function_key))",
         );
         db.exec(
           "CREATE INDEX IF NOT EXISTS role_functions_role_idx ON role_functions(role)",
         );
       } catch {
         void 0;
       }
       SqliteStorage.lastOpenError = null;
       return new SqliteStorage(db);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      SqliteStorage.lastOpenError = message;
      console.error(`[portal] Falha ao abrir SQLite em ${path}: ${message}`);
      return null;
    }

  }

  private one(sql: string, ...params: SqlValue[]) {
    return this.db.prepare(sql).get(...params);
  }
  private many(sql: string, ...params: SqlValue[]) {
    return this.db.prepare(sql).all(...params);
  }
  private num(sql: string, ...params: SqlValue[]): number {
    return Number(this.one(sql, ...params)?.["n"] ?? 0);
  }

  async countUsers() {
    return this.num("SELECT COUNT(*) AS n FROM users");
  }
  async getUserByEmail(email: string) {
    const r = this.one("SELECT * FROM users WHERE email = ? COLLATE NOCASE", email.trim());
    return r ? rowToUser(r) : null;
  }
  async getUserById(id: string) {
    const r = this.one("SELECT * FROM users WHERE id = ?", id);
    return r ? rowToUser(r) : null;
  }
  async listUsers() {
    return this.many("SELECT * FROM users ORDER BY created_at ASC, id ASC").map(rowToUser);
  }
  async listRoleFunctions(role: Role): Promise<RoleFunctionRow[]> {
    return this.many(
      "SELECT role, function_key AS functionKey, description FROM role_functions WHERE role = ? ORDER BY function_key",
      role,
    ).map((r) => ({
      role: r["role"] as Role,
      functionKey: r["functionKey"] as string,
      description: r["description"] as string,
    }));
  }
  async listAllRoleFunctions(): Promise<RoleFunctionRow[]> {
    return this.many(
      "SELECT role, function_key AS functionKey, description FROM role_functions ORDER BY role, function_key",
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
    this.db.prepare("DELETE FROM role_functions WHERE role = ?").run(role);
    const ins = this.db.prepare(
      "INSERT INTO role_functions (role, function_key, description) VALUES (?, ?, ?)",
    );
    for (const f of functions) {
      ins.run(role, f.key, f.description);
    }
  }
  async deleteRoleFunctions(role: Role): Promise<void> {
    this.db.prepare("DELETE FROM role_functions WHERE role = ?").run(role);
  }
  async insertUser(u: UserRow) {
    this.db
      .prepare(
        "INSERT INTO users (id, name, email, role, job_title, department, bio, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
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
    this.db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }
  async deleteUser(id: string) {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
  }
  async clearAllUsers() {
    const n = this.num("SELECT COUNT(*) AS n FROM users");
    this.db.prepare("DELETE FROM sessions").run();
    this.db.prepare("DELETE FROM users").run();
    return n;
  }

  async getSessionByTokenHash(tokenHash: string) {
    const r = this.one("SELECT * FROM sessions WHERE token_hash = ?", tokenHash);
    if (!r) return null;
    return {
      tokenHash: str(r["token_hash"]),
      userId: str(r["user_id"]),
      createdAt: str(r["created_at"]),
      expiresAt: str(r["expires_at"]),
    };
  }
  async insertSession(s: SessionRow) {
    this.db
      .prepare(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run(s.tokenHash, s.userId, s.createdAt, s.expiresAt);
  }
  async deleteSession(tokenHash: string) {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }
  async deleteSessionsForUser(userId: string) {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
  async purgeExpiredSessions(nowIso: string) {
    this.db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso);
  }

  async listColumns() {
    return this.many("SELECT name FROM board_columns ORDER BY position ASC").map((r) =>
      str(r["name"]),
    );
  }
  async insertColumn(name: string) {
    const pos = this.num("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM board_columns");
    const res = this.db
      .prepare("INSERT OR IGNORE INTO board_columns (position, name) VALUES (?, ?)")
      .run(pos, name);
    return Number(res.changes) > 0;
  }
  async deleteColumn(name: string) {
    if ((await this.countTasksInColumn(name)) > 0) return false;
    const res = this.db.prepare("DELETE FROM board_columns WHERE name = ?").run(name);
    return Number(res.changes) > 0;
  }
  async countTasksInColumn(name: string) {
    return this.num("SELECT COUNT(*) AS n FROM tasks WHERE column_name = ?", name);
  }

  async listTasks() {
    return this.many("SELECT * FROM tasks ORDER BY rowid DESC").map((r): Task => ({
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
    const r = this.one("SELECT * FROM tasks WHERE id = ?", id);
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
    this.db
      .prepare(
        "INSERT INTO tasks (id, title, description, column_name, priority, tags, assignee, due, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
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
    this.db.prepare("UPDATE tasks SET column_name = ? WHERE id = ?").run(column, id);
    return { ...task, column };
  }
  async deleteTask(id: string) {
    const info = this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return Number(info.changes) > 0;
  }

  async listComments() {
    return this.many("SELECT * FROM comments ORDER BY at ASC, rowid ASC").map(
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
    this.db
      .prepare(
        "INSERT INTO comments (id, task_id, author_id, author_name, at, body) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(c.id, c.taskId, c.authorId, c.authorName, c.at, c.body);
  }

  async listControls() {
    return this.many("SELECT * FROM controls ORDER BY rowid ASC").map((r): ComplianceControl => ({
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
    }));
  }
  async getControl(id: string) {
    return (await this.listControls()).find((c) => c.id === id) ?? null;
  }
  async insertControl(c: ComplianceControl) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO controls (id, control, norm, owner, role, status, tone, last_review, next_review, overdue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
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
    this.db
      .prepare(
        "UPDATE controls SET status = ?, tone = ?, last_review = ?, next_review = ?, overdue = ? WHERE id = ?",
      )
      .run(patch.status, patch.tone, patch.lastReview, patch.nextReview, patch.overdue ? 1 : 0, id);
  }
  async deleteControl(id: string) {
    const res = this.db.prepare("DELETE FROM controls WHERE id = ?").run(id);
    return Number(res.changes) > 0;
  }

  async listEvidences() {
    return this.many("SELECT * FROM evidences ORDER BY at DESC, rowid DESC").map(
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
    this.db
      .prepare(
        "INSERT INTO evidences (id, control_id, file_name, sent_by_id, sent_by_name, at, status, reviewer_name, reviewed_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
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
    this.db
      .prepare(
        "UPDATE evidences SET status = ?, reviewer_name = ?, reviewed_at = ?, note = ? WHERE id = ?",
      )
      .run(
        patch.status,
        patch.reviewerName ?? null,
        patch.reviewedAt ?? null,
        patch.note ?? null,
        id,
      );
  }

  async insertAudit(a: AuditEntry) {
    this.db
      .prepare(
        "INSERT INTO audit (id, at, actor_id, actor_name, actor_role, action, entity, entity_id, before, after, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
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
    return this.many("SELECT * FROM audit ORDER BY seq DESC").map((r): AuditEntry => ({
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
    return this.num("SELECT COUNT(*) AS n FROM audit");
  }

  async listModules() {
    return this.many("SELECT * FROM modules ORDER BY rowid ASC").map((r): Module => ({
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
    this.db
      .prepare(
        "INSERT OR IGNORE INTO modules (id, name, status, tone, date, done, total) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(m.id, m.name, m.status, m.tone, m.date, m.done, m.total);
  }
  async deleteModule(id: string) {
    const res = this.db.prepare("DELETE FROM modules WHERE id = ?").run(id);
    return Number(res.changes) > 0;
  }

  async listRisks() {
    return this.many("SELECT * FROM risks ORDER BY rowid ASC").map((r): Risk => ({
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
    const r = this.one("SELECT * FROM risks WHERE id = ?", id);
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
    this.db
      .prepare(
        "INSERT OR IGNORE INTO risks (id, title, category, owner, role, probability, impact, mitigation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
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
    this.db
      .prepare(
        "UPDATE risks SET title = ?, category = ?, owner = ?, role = ?, probability = ?, impact = ?, mitigation = ? WHERE id = ?",
      )
      .run(
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
    const res = this.db.prepare("DELETE FROM risks WHERE id = ?").run(id);
    return Number(res.changes) > 0;
  }

  async listWiki() {
    return this.many("SELECT * FROM wiki_articles ORDER BY rowid ASC").map((r): WikiArticle => ({
      slug: str(r["slug"]),
      title: str(r["title"]),
      category: str(r["category"]),
      summary: str(r["summary"]),
      updatedAt: str(r["updated_at"]),
      version: str(r["version"]),
      sections: safeJson(r["sections"], []),
    }));
  }
  async getWiki(slug: string) {
    const r = this.one("SELECT * FROM wiki_articles WHERE slug = ?", slug);
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
    this.db
      .prepare(
        "INSERT OR IGNORE INTO wiki_articles (slug, title, category, summary, updated_at, version, sections) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
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
    this.db
      .prepare(
        "UPDATE wiki_articles SET title = ?, category = ?, summary = ?, updated_at = ?, version = ?, sections = ? WHERE slug = ?",
      )
      .run(
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
    const res = this.db.prepare("DELETE FROM wiki_articles WHERE slug = ?").run(slug);
    return Number(res.changes) > 0;
  }

  async listMilestones() {
    return this.many("SELECT * FROM milestones ORDER BY rowid ASC").map((r): Milestone => ({
      id: str(r["id"]),
      date: str(r["date"]),
      type: str(r["type"]) as Milestone["type"],
      title: str(r["title"]),
      description: str(r["description"]),
    }));
  }
  async insertMilestone(m: Milestone) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO milestones (id, date, type, title, description) VALUES (?, ?, ?, ?, ?)",
      )
      .run(m.id, m.date, m.type, m.title, m.description);
  }
  async deleteMilestone(id: string) {
    const res = this.db.prepare("DELETE FROM milestones WHERE id = ?").run(id);
    return Number(res.changes) > 0;
  }

  async listReleases() {
    return this.many("SELECT * FROM releases ORDER BY rowid DESC").map((r): Release => ({
      version: str(r["version"]),
      date: str(r["date"]),
      items: safeJson(r["items"], []),
    }));
  }
  async insertRelease(r: Release) {
    this.db
      .prepare("INSERT OR IGNORE INTO releases (version, date, items) VALUES (?, ?, ?)")
      .run(r.version, r.date, JSON.stringify(r.items));
  }
  async deleteRelease(version: string) {
    const res = this.db.prepare("DELETE FROM releases WHERE version = ?").run(version);
    return Number(res.changes) > 0;
  }

  async listPatentStages() {
    return this.many("SELECT * FROM patent_stages ORDER BY rowid ASC").map((r): PatentStage => ({
      id: str(r["id"]),
      title: str(r["title"]),
      description: str(r["description"]),
      owner: str(r["owner"]),
      deadline: str(r["deadline"]),
      status: str(r["status"]) as PatentStage["status"],
    }));
  }
  async getPatentStage(id: string) {
    const r = this.one("SELECT * FROM patent_stages WHERE id = ?", id);
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
    this.db
      .prepare(
        "INSERT OR IGNORE INTO patent_stages (id, title, description, owner, deadline, status) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(s.id, s.title, s.description, s.owner, s.deadline, s.status);
  }
  async updatePatentStage(id: string, patch: Partial<PatentStage>) {
    const cur = await this.getPatentStage(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, id };
    this.db
      .prepare(
        "UPDATE patent_stages SET title = ?, description = ?, owner = ?, deadline = ?, status = ? WHERE id = ?",
      )
      .run(next.title, next.description, next.owner, next.deadline, next.status, id);
    return next;
  }

  async listTechStack() {
    return this.many("SELECT * FROM tech_stack ORDER BY rowid ASC").map((r): TechItem => ({
      name: str(r["name"]),
      category: str(r["category"]),
      description: str(r["description"]),
      ...(nul(r["icon"]) ? ({ icon: str(r["icon"]) } as unknown as TechItem) : {}),
    })) as TechItem[];
  }
  async insertTechStack(item: TechItem & { icon?: string }) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO tech_stack (name, category, description, icon) VALUES (?, ?, ?, ?)",
      )
      .run(
        item.name,
        item.category,
        item.description,
        (item as unknown as { icon?: string }).icon ?? null,
      );
  }
  async deleteTechStack(name: string) {
    const res = this.db.prepare("DELETE FROM tech_stack WHERE name = ?").run(name);
    return Number(res.changes) > 0;
  }

  async getMeta(key: string) {
    const r = this.one("SELECT value FROM meta WHERE key = ?", key);
    return r ? str(r["value"]) : null;
  }
  async setMeta(key: string, value: string) {
    this.db
      .prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  async listAutomationShares() {
    return this.many("SELECT * FROM automation_shares ORDER BY created_at DESC").map(
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
    const r = this.one("SELECT * FROM automation_shares WHERE id = ?", id);
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
    const r = this.one("SELECT * FROM automation_shares WHERE workflow_id = ?", workflowId);
    if (!r) return null;
    return this.getAutomationShare(str(r["id"]));
  }
  async upsertAutomationShare(s: AutomationShare) {
    this.db
      .prepare(
        "INSERT INTO automation_shares (id, workflow_id, workflow_name, owner_id, owner_name, owner_role, shared_role, shared_user_ids, is_private, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workflow_id) DO UPDATE SET workflow_name=excluded.workflow_name, shared_role=excluded.shared_role, shared_user_ids=excluded.shared_user_ids, is_private=excluded.is_private",
      )
      .run(
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
    const res = this.db.prepare("DELETE FROM automation_shares WHERE id = ?").run(id);
    return Number(res.changes) > 0;
  }

  async listNextSteps() {
    return this.many("SELECT * FROM next_steps ORDER BY position ASC, created_at ASC").map(
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
    const r = this.one("SELECT * FROM next_steps WHERE id = ?", id);
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
    this.db
      .prepare(
        "INSERT OR IGNORE INTO next_steps (id, title, due, status, position, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(s.id, s.title, s.due, s.status, s.position, s.createdAt);
  }
  async updateNextStep(id: string, patch: Partial<NextStep>) {
    const cur = await this.getNextStep(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, id };
    this.db
      .prepare("UPDATE next_steps SET title = ?, due = ?, status = ?, position = ? WHERE id = ?")
      .run(next.title, next.due, next.status, next.position, id);
    return next;
  }
  async deleteNextStep(id: string) {
    const res = this.db.prepare("DELETE FROM next_steps WHERE id = ?").run(id);
    return Number(res.changes) > 0;
  }
  async reorderNextSteps(orderedIds: string[]) {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (id) this.db.prepare("UPDATE next_steps SET position = ? WHERE id = ?").run(i, id);
    }
  }

  async listLegalDocs() {
    const rows = this.many(
      "SELECT * FROM legal_docs WHERE id IN (SELECT id FROM legal_docs GROUP BY slug HAVING MAX(published_at)) ORDER BY slug ASC",
    );
    if (rows.length === 0)
      return this.many("SELECT * FROM legal_docs ORDER BY slug ASC, published_at DESC").map(
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
    for (const r of this.many("SELECT * FROM legal_docs ORDER BY published_at DESC")) {
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
    const r = this.one(
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
    const r = this.one("SELECT * FROM legal_docs WHERE id = ?", id);
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
    return this.many(
      "SELECT * FROM legal_docs WHERE slug = ? ORDER BY published_at DESC",
      slug,
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
    this.db
      .prepare(
        "INSERT INTO legal_docs (id, slug, title, subtitle, version, intro, clauses, published_at, created_at, updated_at, created_by_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
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
    return this.many("SELECT * FROM password_reset_tokens ORDER BY created_at DESC").map((r) => ({
      tokenHash: str(r["token_hash"]),
      userId: str(r["user_id"]),
      createdAt: str(r["created_at"]),
      expiresAt: str(r["expires_at"]),
      usedAt: nul(r["used_at"]),
    }));
  }
  async getResetTokenByHash(tokenHash: string) {
    const r = this.one("SELECT * FROM password_reset_tokens WHERE token_hash = ?", tokenHash);
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
    this.db
      .prepare(
        "INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(t.tokenHash, t.userId, t.createdAt, t.expiresAt, t.usedAt);
  }
  async markResetTokenUsed(tokenHash: string, usedAt: string) {
    this.db
      .prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?")
      .run(usedAt, tokenHash);
  }
  async deleteExpiredResetTokens(nowIso: string) {
    this.db
      .prepare("DELETE FROM password_reset_tokens WHERE expires_at < ? AND used_at IS NULL")
      .run(nowIso);
  }

  async listSessionsForUser(userId: string) {
    return this.many(
      "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
      userId,
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
    ] = await Promise.all([
      this.listUsers(),
      this.many("SELECT * FROM sessions").map((r) => ({
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
      this.many("SELECT * FROM legal_docs ORDER BY published_at DESC").map((r): LegalDoc => ({
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
      })),
      this.listResetTokens(),
      this.many("SELECT * FROM meta"),
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
    };
  }
  async importDatabase(dump: DatabaseDump): Promise<void> {
    this.db.exec("BEGIN");
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
        "meta",
      ];
      for (const t of tables) this.db.exec(`DELETE FROM ${t}`);
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
      for (const [k, v] of Object.entries(dump.meta ?? {})) await this.setMeta(k, v);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
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
    return this.many("SELECT * FROM docs ORDER BY rowid ASC").map(rowToDoc);
  }
  async listDocsByKind(kind: string) {
    return this.many("SELECT * FROM docs WHERE kind = ? ORDER BY rowid ASC", kind).map(rowToDoc);
  }
  async getDoc(id: string) {
    const r = this.one("SELECT * FROM docs WHERE id = ?", id);
    return r ? rowToDoc(r) : null;
  }
  async upsertDoc(doc: DocRecord) {
    this.db
      .prepare(
        `INSERT INTO docs (id, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(doc.id, doc.kind, JSON.stringify(doc.data), doc.createdAt, doc.updatedAt);
  }
  async deleteDoc(id: string) {
    return Number(this.db.prepare("DELETE FROM docs WHERE id = ?").run(id).changes) > 0;
  }

  /* --- convites de cadastro --- */
  async insertInvite(i: InviteRow) {
    this.db
      .prepare(
        `INSERT INTO invites (code_hash, id, email, role, hint, created_by, created_by_name, created_at, expires_at, used_at, used_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
    return this.many("SELECT * FROM invites ORDER BY created_at DESC").map(rowToInvite);
  }
  async getInviteByHash(codeHash: string) {
    const r = this.one("SELECT * FROM invites WHERE code_hash = ?", codeHash);
    return r ? rowToInvite(r) : null;
  }
  async markInviteUsed(codeHash: string, usedAt: string, usedBy: string) {
    this.db
      .prepare("UPDATE invites SET used_at = ?, used_by = ? WHERE code_hash = ?")
      .run(usedAt, usedBy, codeHash);
  }
  async deleteInvite(id: string) {
    return Number(this.db.prepare("DELETE FROM invites WHERE id = ?").run(id).changes) > 0;
  }
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
  }
  async clearAllUsers() {
    const n = this.users.length;
    this.users = [];
    this.sessions = [];
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
    return this.risks.map((r) => ({ ...r, role: (r.role ?? "gestor") as Risk["role"] }));
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
    for (const m of modules)
      await storage.insertModule({ ...m, date: isoFromBrOrText(m.date) });
  }
  if ((await storage.listPatentStages()).length === 0) {
    for (const p of patentStages)
      await storage.insertPatentStage({ ...p, deadline: isoFromBrOrText(p.deadline) });
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
      await storage.syncRoleFunctions(role, roleFunctionsData[role].map((f) => ({ key: f.key, description: f.description })));
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
    const { id: _id, ...rest } = { ...s, deadline: isoFromBrOrText(s.deadline) };
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

function resolveDatabasePath(): string {
  const fromEnv =
    typeof process !== "undefined" && process.env
      ? (process.env["DATABASE_PATH"] ?? "").trim()
      : "";
  // Nunca use `import.meta.url` aqui: no runtime edge (workerd) ele pode não ser
  // uma URL válida e `new URL(...)` lança "Invalid URL string.", derrubando o SSR.
  if (fromEnv.length > 0) return fromEnv;
  return ".data/portal.db";
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
 * 2. SQLite em memória quando há node:sqlite mas não FS gravável;
 * 3. Driver JS em memória como último recurso.
 * Tarefas, marcos e releases começam vazios: são cadastrados pelos usuários.
 */
export function getStorage(): Promise<Storage> {
  storagePromise ??= initStorage();
  return storagePromise;
}

async function initStorage(): Promise<Storage> {
  const path = resolveDatabasePath();
  console.info(`[portal] Caminho do banco: ${path}`);
  const requirePersistent = isRequirePersistent();
  if (path !== ":memory:") {
    try {
      const fileDb = await SqliteStorage.open(path);
      if (fileDb) {
        await seedIfEmpty(fileDb);
        activePersistent = true;
        storageInitError = null;
        console.info(`[portal] SQLite persistente em ${path}`);
        return fileDb;
      }
    } catch (e) {
      console.error(`[portal] Falha ao abrir SQLite em ${path}:`, e);
    }
    if (requirePersistent) {
      storageInitError = `STORAGE_REQUIRE_PERSISTENT=1 mas não foi possível abrir SQLite em ${path}. Verifique DATABASE_PATH e permissões de disco.`;
      console.error(`[portal] ${storageInitError}`);
      throw new Error(storageInitError);
    }
    console.warn(`[portal] Falha ao abrir SQLite em ${path}, caindo para memória.`);
  } else if (requirePersistent) {
    storageInitError = `STORAGE_REQUIRE_PERSISTENT=1 mas DATABASE_PATH=:memory:. Configure um caminho persistente.`;
    console.error(`[portal] ${storageInitError}`);
    throw new Error(storageInitError);
  }
  const memorySqlite = await SqliteStorage.open(":memory:");
  if (memorySqlite) {
    await seedIfEmpty(memorySqlite);
    activePersistent = false;
    if (!storageInitError)
      storageInitError =
        "Armazenamento em memória (volátil): os dados serão perdidos a cada reinício. Configure DATABASE_PATH persistente.";
    console.warn(`[portal] ${storageInitError}`);
    return memorySqlite;
  }
  const fallback = new MemoryStorage();
  await seedIfEmpty(fallback);
  activePersistent = false;
  if (!storageInitError)
    storageInitError = "node:sqlite indisponível: armazenamento em memória (não persistente).";
  console.warn(`[portal] ${storageInitError}`);
  return fallback;
}
