import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { SqliteBackend, SCHEMA } from "./storage";
import type { StorageInfo } from "./storage";

/**
 * Postgres (Neon) via @neondatabase/serverless — persiste na Vercel.
 * Usa HTTP polling (neon()) em vez de TCP sockets (pg), compatível com Vercel serverless.
 * Ativado quando POSTGRES_URL / DATABASE_URL (postgres://) estiver definido.
 *
 * O driver neon() aceita `sql("... $1 ...", [p1, p2])` (query com placeholders)
 * ou `sql\`... ${p} ...\`` (tagged template). Ambos retornam array de rows.
 */
export class PostgresStorage extends SqliteBackend {
  static lastOpenError: string | null = null;
  readonly kind: StorageInfo["kind"] = "sqlite" as const;
  private sql: NeonQueryFunction<false, false>;
  private dbUrl: string;

  private constructor(sql: NeonQueryFunction<false, false>, url: string) {
    super();
    this.sql = sql;
    this.dbUrl = url;
  }

  static async open(connectionString: string): Promise<PostgresStorage | null> {
    try {
      const sql = neon(connectionString);
      const test = await sql`SELECT 1 AS ok`;
      if (!test) throw new Error("SELECT 1 falhou");
      const store = new PostgresStorage(sql, connectionString);
      await store.execSchema();
      return store;
    } catch (e) {
      PostgresStorage.lastOpenError = e instanceof Error ? e.message : String(e);
      console.warn(`[portal] PostgresStorage falhou: ${PostgresStorage.lastOpenError}`);
      return null;
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
    return pgSql;
  }

  private async query(sqlStr: string, params: any[] = []): Promise<{ rows: any[] }> {
    const pgSql = this.toPg(sqlStr);
    if (params.length === 0) {
      const res = await this.sql(pgSql as any);
      return { rows: Array.isArray(res) ? res : [] };
    }
    // neon() aceita (sql, params) na chamada de função
    const res = await this.sql(pgSql as any, params) as any;
    return { rows: Array.isArray(res) ? res : [] };
  }

  private async exec(sql: string): Promise<void> {
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

  protected override async one(sql: string, ...params: any[]): Promise<Record<string, any> | undefined> {
    const { rows } = await this.query(sql, params);
    const row = rows[0];
    if (!row) return undefined;
    const mapped: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) mapped[k.toLowerCase()] = v;
    return { ...row, ...mapped };
  }

  protected override async many(sql: string, ...params: any[]): Promise<Record<string, any>[]> {
    const { rows } = await this.query(sql, params);
    return rows.map((row: any) => {
      const mapped: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) mapped[k.toLowerCase()] = v;
      return { ...row, ...mapped };
    });
  }

  protected override async run(sql: string, ...params: any[]): Promise<{ changes: number }> {
    const { rows } = await this.query(sql, params);
    return { changes: Array.isArray(rows) ? rows.length : 0 };
  }

  override async getStorageInfo(): Promise<StorageInfo> {
    return {
      kind: "sqlite",
      persistent: true,
      path: `postgres:${this.dbUrl.split("@").pop()?.split("?")[0] ?? "neon"}`,
      initError: null,
    };
  }
}
