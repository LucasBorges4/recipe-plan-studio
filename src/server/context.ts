import type { AuditableRole } from "@/lib/rbac";
import type { Storage } from "./storage";

/**
 * Contexto compartilhado pelos handlers de server functions.
 *
 * Este módulo só pode ser carregado dinamicamente dentro dos handlers
 * (`await import("./context")`) — assim o bundler cliente nunca inclui
 * node:sqlite nem os segredos do servidor no bundle do navegador.
 */

export interface ServerContext {
  storage: Storage;
  auth: typeof import("./auth");
  pw: typeof import("./passwords");
  pepper: string;
}

/** Pepper global: env AUTH_PEPPER tem prioridade; sem ela, gera uma vez e persiste na tabela meta. */
export async function resolvePepper(storage: Storage): Promise<string> {
  const fromEnv =
    typeof process !== "undefined" && process.env ? process.env["AUTH_PEPPER"] : undefined;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();

  const KEY = "auth_pepper";
  const stored = await storage.getMeta(KEY);
  if (stored) return stored;

  const { generatePepperBase64 } = await import("./passwords");
  const generated = generatePepperBase64();
  await storage.setMeta(KEY, generated);
  return generated;
}

export async function serverCtx(): Promise<ServerContext> {
  const [{ getStorage }, auth, pw] = await Promise.all([
    import("./storage"),
    import("./auth"),
    import("./passwords"),
  ]);
  const storage = await getStorage();
  return { storage, auth, pw, pepper: await resolvePepper(storage) };
}

/* ------------------------------------------------------------------ */
/* Identificadores                                                     */
/* ------------------------------------------------------------------ */

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function newId(prefix: string): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let rand = "";
  for (const b of bytes) rand += ID_ALPHABET[b % ID_ALPHABET.length];
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/* ------------------------------------------------------------------ */
/* Trilha de auditoria                                                 */
/* ------------------------------------------------------------------ */

export interface AuditActor {
  id: string | null;
  name: string;
  role: AuditableRole;
}

export async function logAudit(
  storage: Storage,
  actor: AuditActor | null,
  entry: {
    action: string;
    entity: string;
    entityId: string;
    before?: string;
    after?: string;
    reason?: string;
  },
): Promise<void> {
  await storage.insertAudit({
    id: newId("aud"),
    at: new Date().toISOString(),
    actor: actor?.name ?? "sistema",
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? "sistema",
    ...entry,
  });
}

/* ------------------------------------------------------------------ */
/* Limitador de tentativas (login/cadastro)                            */
/* ------------------------------------------------------------------ */

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function attemptBucket(key: string) {
  const now = Date.now();
  const bucket = attempts.get(key);
  if (!bucket || bucket.resetAt < now) {
    const fresh = { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
    attempts.set(key, fresh);
    if (attempts.size > 500) {
      for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
    }
    return fresh;
  }
  return bucket;
}

export async function requestKey(scope: string, identifier: string): Promise<string> {
  let ip = "desconhecido";
  try {
    const { getRequestIP } = await import("@tanstack/react-start/server");
    ip = getRequestIP({ xForwardedFor: true }) ?? "desconhecido";
  } catch {
    /* fora de contexto HTTP */
  }
  return `${scope}|${ip}|${identifier.trim().toLowerCase()}`;
}

export function isRateLimited(key: string): boolean {
  return attemptBucket(key).count >= MAX_ATTEMPTS;
}

export function registerFailure(key: string): void {
  attemptBucket(key).count += 1;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
