import { createClient, type Client } from "@libsql/client";
import { SqliteBackend } from "./storage";
import type { StorageInfo } from "./storage";

/**
 * Turso / libSQL remoto — SQLite compatível, persiste na nuvem.
 * Ativado quando TURSO_DATABASE_URL (ou LIBSQL_URL) estiver definido.
 * Usa EXATAMENTE o mesmo DDL e queries do SqliteBackend, mas via HTTP.
 */
export class TursoStorage extends SqliteBackend {
  static override lastOpenError: string | null = null;
  override readonly kind: StorageInfo["kind"] = "sqlite" as const;
  private client: Client;
  private dbUrl: string;

  private constructor(client: Client, url: string) {
    super();
    this.client = client;
    this.dbUrl = url;
  }

  static async open(url: string, authToken?: string): Promise<TursoStorage | null> {
    try {
      const client = createClient({ url, authToken: authToken ?? "" } as unknown as Parameters<typeof createClient>[0]);
      // testa conexão
      await client.execute("SELECT 1");
      const store = new TursoStorage(client, url);
      await store.execSchema();
      return store;
    } catch (e) {
      TursoStorage.lastOpenError = e instanceof Error ? e.message : String(e);
      console.warn(`[portal] TursoStorage falhou ${url}: ${TursoStorage.lastOpenError}`);
      return null;
    }
  }

  private async execSchema() {
    // Importa SCHEMA do SqliteBackend via execução direta
    const { SCHEMA } = await import("./storage");
    // SCHEMA é string com múltiplos CREATE TABLE — libera via exec
    await this.exec(SCHEMA);
  }

  protected override async one(sql: string, ...params: (string | number | null | Uint8Array)[]): Promise<Record<string, any> | undefined> {
    const r = await this.client.execute({ sql, args: params as any });
    const row: any = r.rows[0];
    if (!row) return undefined;
    if (Array.isArray(row)) {
      const obj: Record<string, any> = {};
      r.columns.forEach((col, i) => (obj[col] = row[i]));
      return obj;
    }
    return row as Record<string, any>;
  }

  protected override async many(sql: string, ...params: any[]): Promise<Record<string, any>[]> {
    const r = await this.client.execute({ sql, args: params });
    return r.rows.map((row: any) => {
      if (Array.isArray(row)) {
        const obj: Record<string, any> = {};
        r.columns.forEach((col: string, i: number) => (obj[col] = row[i]));
        return obj;
      }
      return row as Record<string, any>;
    });
  }

  protected override async run(sql: string, ...params: any[]): Promise<{ changes: number }> {
    const r = await this.client.execute({ sql, args: params });
    return { changes: r.rowsAffected ?? 0 };
  }

  protected override async exec(sql: string): Promise<void> {
    // libsql não suporta multi-statement em um execute, quebra por ;
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await this.client.execute(stmt);
    }
  }

  override async getStorageInfo(): Promise<StorageInfo> {
    return {
      kind: "sqlite",
      persistent: true,
      path: `turso:${this.dbUrl}`,
      lastBackupAt: await this.getMeta("last_backup_at").catch(() => null),
      requirePersistent: false,
    };
  }
}
