import type { ComplianceControl, Module, Priority, Task } from "@/data/types";
import type { AuditEntry, CommentRecord, EvidenceRecord } from "@/lib/records";
import type { Role } from "@/lib/rbac";

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
    patch: Partial<Pick<UserRow, "role" | "name" | "jobTitle">>,
  ): Promise<void>;
  deleteUser(id: string): Promise<void>;

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

  listComments(): Promise<CommentRecord[]>;
  insertComment(comment: CommentRecord): Promise<void>;

  listControls(): Promise<ComplianceControl[]>;
  getControl(id: string): Promise<ComplianceControl | null>;
  insertControl(control: ComplianceControl): Promise<void>;
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

  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
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
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
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
    passwordHash: str(r["password_hash"]),
    passwordSalt: str(r["password_salt"]),
    createdAt: str(r["created_at"]),
  };
}

class SqliteStorage implements Storage {
  readonly kind = "sqlite" as const;

  private constructor(private db: SqlDatabase) {}

  static async open(path: string): Promise<SqliteStorage | null> {
    try {
      const mod = (await import("node:sqlite")) as unknown as {
        DatabaseSync: new (path: string, opts?: object) => SqlDatabase;
      };
      const db = new mod.DatabaseSync(path);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA foreign_keys = ON;");
      db.exec(SCHEMA);
      return new SqliteStorage(db);
    } catch {
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
  async insertUser(u: UserRow) {
    this.db
      .prepare(
        "INSERT INTO users (id, name, email, role, job_title, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        u.id,
        u.name,
        u.email,
        u.role,
        u.jobTitle,
        u.passwordHash,
        u.passwordSalt,
        u.createdAt,
        u.createdAt,
      );
  }
  async updateUser(id: string, patch: Partial<Pick<UserRow, "role" | "name" | "jobTitle">>) {
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
    if (!sets.length) return;
    sets.push("updated_at = ?");
    params.push(new Date().toISOString(), id);
    this.db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }
  async deleteUser(id: string) {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
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
        "INSERT OR IGNORE INTO controls (id, control, norm, owner, status, tone, last_review, next_review, overdue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        c.id,
        c.control,
        c.norm,
        c.owner,
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

/* ------------------------------------------------------------------ */
/* Driver em memória                                                   */
/* ------------------------------------------------------------------ */

class MemoryStorage implements Storage {
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
  private meta = new Map<string, string>();

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
  async insertUser(u: UserRow) {
    this.users.push(u);
  }
  async updateUser(id: string, patch: Partial<Pick<UserRow, "role" | "name" | "jobTitle">>) {
    this.users = this.users.map((u) => (u.id === id ? { ...u, ...patch } : u));
  }
  async deleteUser(id: string) {
    this.users = this.users.filter((u) => u.id !== id);
    this.sessions = this.sessions.filter((s) => s.userId !== id);
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

  async listComments() {
    return [...this.comments];
  }
  async insertComment(c: CommentRecord) {
    this.comments.push(c);
  }

  async listControls() {
    return this.controls.map((c) => ({ ...c }));
  }
  async getControl(id: string) {
    return this.controls.find((c) => c.id === id) ?? null;
  }
  async insertControl(c: ComplianceControl) {
    if (!this.controls.some((x) => x.id === c.id)) this.controls.push({ ...c });
  }
  async reviewControl(
    id: string,
    patch: Pick<ComplianceControl, "status" | "tone" | "lastReview" | "nextReview" | "overdue">,
  ) {
    const control = this.controls.find((c) => c.id === id);
    if (!control) return;
    Object.assign(control, patch);
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

  async getMeta(key: string) {
    return this.meta.get(key) ?? null;
  }
  async setMeta(key: string, value: string) {
    this.meta.set(key, value);
  }
}

/* ------------------------------------------------------------------ */
/* Semente inicial + inicialização                                     */
/* ------------------------------------------------------------------ */

async function seedIfEmpty(storage: Storage): Promise<void> {
  if ((await storage.listColumns()).length > 0) return;
  const [{ kanbanColumns, tasks }, { controls }, { modules }] = await Promise.all([
    import("@/data/tasks"),
    import("@/data/compliance"),
    import("@/data/modules"),
  ]);
  for (const [position, name] of kanbanColumns.entries()) {
    await storage.insertColumn(name);
  }
  for (const t of tasks) await storage.insertTask(t);
  for (const c of controls) await storage.insertControl(c);
  for (const m of modules) await storage.insertModule(m);
}

let storagePromise: Promise<Storage> | undefined;
let activePersistent = false;

/** Indica se o storage atual persiste em disco (SQLite em arquivo). Falso no modo em memória. */
export function isStoragePersistent(): boolean {
  return activePersistent;
}

function resolveDatabasePath(): string {
  const fromEnv =
    typeof process !== "undefined" && process.env ? process.env["DATABASE_PATH"] : undefined;
  return fromEnv && fromEnv.trim().length > 0 ? fromEnv.trim() : ".data/portal.db";
}

/**
 * Retorna o storage do processo:
 * 1. SQLite em arquivo (persistente) quando DATABASE_PATH abre com sucesso;
 * 2. SQLite em memória quando há node:sqlite mas não FS gravável;
 * 3. Driver JS em memória como último recurso.
 * Em todos os casos o banco começa populado com os dados de demonstração.
 */
export function getStorage(): Promise<Storage> {
  storagePromise ??= initStorage();
  return storagePromise;
}

async function initStorage(): Promise<Storage> {
  const path = resolveDatabasePath();
  if (path !== ":memory:") {
    const fileDb = await SqliteStorage.open(path);
    if (fileDb) {
      await seedIfEmpty(fileDb);
      activePersistent = true;
      console.info(`[portal] SQLite persistente em ${path}`);
      return fileDb;
    }
  }
  const memorySqlite = await SqliteStorage.open(":memory:");
  if (memorySqlite) {
    await seedIfEmpty(memorySqlite);
    activePersistent = false;
    console.warn(
      "[portal] Sem disco gravável: SQLite em memória. Os dados são reiniciados a cada instância.",
    );
    return memorySqlite;
  }
  const fallback = new MemoryStorage();
  await seedIfEmpty(fallback);
  activePersistent = false;
  console.warn("[portal] node:sqlite indisponível: armazenamento em memória (não persistente).");
  return fallback;
}
