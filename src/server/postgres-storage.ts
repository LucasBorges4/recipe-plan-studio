import { SqliteBackend, SCHEMA } from "./storage";
import type { StorageInfo } from "./storage";

type QueryRunner = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;

function isNeonUrl(url: string): boolean {
  return url.includes("neon.tech") || url.includes("pooler.supabase") || url.includes(".neon.");
}

const PG_ALIAS_MAP: Record<string, string> = {
  functionkey: "functionKey",
  userid: "userId",
  grantedat: "grantedAt",
  grantedby: "grantedBy",
};

function normalizePgRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(row)) {
    const lower = k.toLowerCase();
    out[lower] = v;
    const alias = PG_ALIAS_MAP[lower];
    if (alias) out[alias] = v;
  }
  return out;
}

export class PostgresStorage extends SqliteBackend {
  static override lastOpenError: string | null = null;
  override readonly kind: StorageInfo["kind"] = "sqlite" as const;
  private queryRunner!: QueryRunner;
  private dbUrl: string;
  private pgPool: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>; end: () => Promise<void> } | null = null;

  private constructor(url: string) {
    super();
    this.dbUrl = url;
  }

  static async open(connectionString: string): Promise<PostgresStorage | null> {
    const store = new PostgresStorage(connectionString);
    try {
      if (isNeonUrl(connectionString)) {
        const { neon } = await import("@neondatabase/serverless");
        const sql = neon(connectionString);
        const test = await (sql as unknown as (s: TemplateStringsArray) => Promise<unknown[]>)`SELECT 1 AS ok`;
        if (!test) throw new Error("SELECT 1 falhou");
        store.queryRunner = async (sqlStr: string, params: unknown[] = []) => {
          const pgSql = store.toPg(sqlStr);
          const res = params.length === 0 ? await (sql as unknown as (q: string) => Promise<unknown[]>)(pgSql) : await (sql as unknown as (q: string, p: unknown[]) => Promise<unknown[]>)(pgSql, params);
          return { rows: Array.isArray(res) ? res : [] };
        };
      } else {
        const { Pool } = await import("pg");
        const pool = new Pool({ connectionString, ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined, max: 5 });
        await pool.query("SELECT 1");
        store.pgPool = pool;
        store.queryRunner = async (sqlStr: string, params: unknown[] = []) => {
          const pgSql = store.toPg(sqlStr);
          const res = await pool.query(pgSql, params as unknown[]);
          return { rows: res.rows as unknown[], rowCount: res.rowCount ?? 0 };
        };
      }
      await store.execSchema();
      return store;
    } catch (e) {
      PostgresStorage.lastOpenError = e instanceof Error ? e.message : String(e);
      console.warn(`[portal] PostgresStorage falhou: ${PostgresStorage.lastOpenError}`);
      try {
        await store.pgPool?.end();
      } catch {
        void 0;
      }
      return null;
    }
  }

  protected override async exec(sql: string): Promise<void> {
    const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        await this.query(stmt);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/already exists|duplicate|ainda existe/i.test(msg)) {
          console.warn(`[portal] exec error: ${msg} | SQL: ${stmt.substring(0, 100)}`);
        }
      }
    }
  }

  private async execSchema() {
    let pgSchema = SCHEMA
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "SERIAL PRIMARY KEY")
      .replace(/ COLLATE NOCASE/g, "");
    await this.exec(pgSchema);
    await this.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));`).catch(() => {});
  }

  /** Converte SQL SQLite para Postgres (placeholders $n, INSERT OR IGNORE, COLLATE NOCASE). */
  private toPg(sql: string): string {
    let idx = 0;
    let pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    const hadOrIgnore = /OR IGNORE/i.test(sql);
    pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, "INSERT INTO");
    if (hadOrIgnore && !pgSql.toUpperCase().includes("ON CONFLICT")) {
      pgSql = pgSql.replace(/;?\s*$/, " ON CONFLICT DO NOTHING");
    }
    pgSql = pgSql.replace(/(\w+)\s*=\s*\$(\d+)\s+COLLATE NOCASE/gi, "LOWER($1)=LOWER($$$2)");
    pgSql = pgSql.replace(/COLLATE NOCASE/gi, "");
    pgSql = pgSql.replace(/\browid\b/gi, "ctid");
    return pgSql;
  }

  private async query(sqlStr: string, params: any[] = []): Promise<{ rows: any[] }> {
    return this.queryRunner(sqlStr, params);
  }

  protected override async one(sql: string, ...params: any[]): Promise<Record<string, any> | undefined> {
    const { rows } = await this.query(sql, params);
    const row = rows[0];
    if (!row) return undefined;
    return normalizePgRow(row as Record<string, unknown>) as Record<string, unknown>;
  }

  protected override async many(sql: string, ...params: any[]): Promise<Record<string, any>[]> {
    const { rows } = await this.query(sql, params);
    return rows.map((row: unknown) => normalizePgRow(row as Record<string, unknown>) as Record<string, unknown>);
  }

  protected override async run(sql: string, ...params: any[]): Promise<{ changes: number }> {
    const upper = sql.trim().toUpperCase();
    if (upper === "BEGIN" || upper === "COMMIT" || upper === "ROLLBACK") return { changes: 0 };
    const res = await this.queryRunner(sql, params);
    if (res.rowCount !== undefined) return { changes: res.rowCount };
    const { rows } = res;
    if (upper.startsWith("INSERT") || upper.startsWith("UPDATE") || upper.startsWith("DELETE")) {
      return { changes: Array.isArray(rows) && rows.length > 0 ? 1 : 0 };
    }
    return { changes: Array.isArray(rows) ? rows.length : 0 };
  }

  override async listLegalDocs(): Promise<import("./storage").LegalDoc[]> {
    const rows = await this.many("SELECT * FROM legal_docs ORDER BY published_at DESC");
    if (rows.length === 0) return [];
    const latest = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      const slug = String((r as Record<string, unknown>)["slug"] ?? (r as Record<string, unknown>)["Slug"] ?? "");
      if (!latest.has(slug)) latest.set(slug, r as Record<string, unknown>);
    }
    const safeJson = (v: unknown, fb: unknown) => {
      if (typeof v !== "string") return fb as never;
      try { return JSON.parse(v as string) as never; } catch { return fb as never; }
    };
    const str = (v: unknown, fb = ""): string => typeof v === "string" ? v : typeof v === "number" ? String(v) : fb;
    const nul = (v: unknown): string | null => typeof v === "string" ? v : null;
    return Array.from(latest.values()).map((r): import("./storage").LegalDoc => ({
      id: str((r as Record<string, unknown>)["id"] ?? (r as Record<string, unknown>)["ID"]),
      slug: str((r as Record<string, unknown>)["slug"]),
      title: str((r as Record<string, unknown>)["title"]),
      subtitle: str((r as Record<string, unknown>)["subtitle"]),
      version: str((r as Record<string, unknown>)["version"]),
      intro: str((r as Record<string, unknown>)["intro"]),
      clauses: safeJson((r as Record<string, unknown>)["clauses"], []),
      publishedAt: str((r as Record<string, unknown>)["published_at"]),
      createdAt: str((r as Record<string, unknown>)["created_at"]),
      updatedAt: str((r as Record<string, unknown>)["updated_at"]),
      createdById: nul((r as Record<string, unknown>)["created_by_id"]),
    }));
  }

  override async getStorageInfo(): Promise<StorageInfo> {
    return {
      kind: "sqlite",
      persistent: true,
      path: `postgres:${this.dbUrl.split("@").pop()?.split("?")[0] ?? "neon"}`,
      lastBackupAt: await this.getMeta("last_backup_at").catch(() => null),
      requirePersistent: false,
    };
  }
}
