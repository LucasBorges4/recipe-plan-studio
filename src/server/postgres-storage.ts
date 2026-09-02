import pg from "pg";
import { SqliteBackend, SCHEMA } from "./storage";
import type { StorageInfo } from "./storage";

/**
 * Postgres (Neon) — persiste na Vercel.
 * Ativado quando POSTGRES_URL / DATABASE_URL (postgres://) estiver definido.
 * Traduz SQL SQLite -> Postgres ( ? -> $n, INSERT OR IGNORE, COLLATE NOCASE, AUTOINCREMENT )
 */
export class PostgresStorage extends SqliteBackend {
  static lastOpenError: string | null = null;
  readonly kind: StorageInfo["kind"] = "sqlite" as const; // reporta como sqlite para compatibilidade UI
  private pool: pg.Pool;
  private dbUrl: string;

  private constructor(pool: pg.Pool, url: string) {
    super();
    this.pool = pool;
    this.dbUrl = url;
  }

  static async open(connectionString: string): Promise<PostgresStorage | null> {
    try {
      const pool = new pg.Pool({
        connectionString,
        ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
        max: 5,
      });
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
      } finally {
        client.release();
      }
      const store = new PostgresStorage(pool, connectionString);
      await store.execSchema();
      return store;
    } catch (e) {
      PostgresStorage.lastOpenError = e instanceof Error ? e.message : String(e);
      console.warn(`[portal] PostgresStorage falhou: ${PostgresStorage.lastOpenError}`);
      return null;
    }
  }

  private async execSchema() {
    // Ajusta SCHEMA SQLite -> Postgres
    let pgSchema = SCHEMA
      // AUTOINCREMENT -> SERIAL
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "SERIAL PRIMARY KEY")
      // Remove COLLATE NOCASE (Postgres usa ILIKE/LOWER, mas UNIQUE já resolve com LOWER)
      .replace(/ COLLATE NOCASE/g, "")
      // Garante IF NOT EXISTS já compatível
      ;
    // Executa statement a statement
    await this.exec(pgSchema);
    // Índice único para email case-insensitive (substitui COLLATE NOCASE UNIQUE)
    await this.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));`).catch(() => {});
  }

  private toPg(sql: string): string {
    // Converte ? placeholders para $1,$2...
    let idx = 0;
    let pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    // INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
    const hadOrIgnore = /OR IGNORE/i.test(sql);
    pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, "INSERT INTO");
    if (hadOrIgnore && !pgSql.toUpperCase().includes("ON CONFLICT")) {
      pgSql = pgSql.replace(/;?\s*$/, " ON CONFLICT DO NOTHING");
    }
    // COLLATE NOCASE -> LOWER() para case-insensitive (Postgres)
    pgSql = pgSql.replace(/(\w+)\s*=\s*\$(\d+)\s+COLLATE NOCASE/gi, "LOWER($1)=LOWER($$$2)");
    // Normaliza COLLATE restante
    pgSql = pgSql.replace(/COLLATE NOCASE/gi, "");
    return pgSql;
  }

  protected async one(sql: string, ...params: any[]): Promise<Record<string, any> | undefined> {
    const pgSql = this.toPg(sql);
    const r = await this.pool.query(pgSql, params);
    const row = r.rows[0];
    if (!row) return undefined;
    // Normaliza chaves para minúsculas como SQLite (lowercase)
    const mapped: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) mapped[k.toLowerCase()] = v;
    // Também mantém original, e converte snake_case já esperado
    // SQLite retorna colunas como escritas; mapeia aliases já via SQL AS
    return { ...row, ...mapped };
  }

  protected async many(sql: string, ...params: any[]): Promise<Record<string, any>[]> {
    const pgSql = this.toPg(sql);
    const r = await this.pool.query(pgSql, params);
    return r.rows.map((row: any) => {
      const mapped: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) mapped[k.toLowerCase()] = v;
      return { ...row, ...mapped };
    });
  }

  protected async run(sql: string, ...params: any[]): Promise<{ changes: number }> {
    const pgSql = this.toPg(sql);
    const r = await this.pool.query(pgSql, params);
    return { changes: r.rowCount ?? 0 };
  }

  protected async exec(sql: string): Promise<void> {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      const pgSql = this.toPg(stmt);
      await this.pool.query(pgSql);
    }
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
