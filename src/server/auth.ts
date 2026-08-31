import { getCookie, setCookie, deleteCookie, getRequestHeader } from "@tanstack/react-start/server";
import type { PublicUser } from "@/lib/rbac";
import { can, type Permission } from "@/lib/rbac";
import type { Storage, UserRow } from "./storage";

/**
 * Sessões por cookie httpOnly com token opaco de 256 bits.
 * O banco guarda apenas o SHA-256 do token — um vazamento do banco não
 * permite sequestrar sessões, e o cookie nunca toca o JavaScript do cliente.
 */

export const SESSION_COOKIE = "geos_session";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function isSecureRequest(): boolean {
  try {
    const proto = getRequestHeader("x-forwarded-proto");
    return proto ? proto.split(",")[0]?.trim() === "https" : false;
  } catch {
    return false;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function publicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    jobTitle: u.jobTitle,
    department: u.department,
    bio: u.bio,
  };
}

/** Cria a sessão no banco e grava o cookie httpOnly na resposta em curso. */
export async function createSession(storage: Storage, userId: string): Promise<void> {
  await storage.deleteSessionsForUser(userId);
  await storage.purgeExpiredSessions(new Date().toISOString());
  const token = randomToken();
  const now = Date.now();
  await storage.insertSession({
    tokenHash: await sha256Hex(token),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  });
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Encerra a sessão atual (se houver) e remove o cookie. */
export async function destroyCurrentSession(storage: Storage): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) await storage.deleteSession(await sha256Hex(token));
  deleteCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(),
    path: "/",
  });
}

export async function getCurrentUser(storage: Storage): Promise<UserRow | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const session = await storage.getSessionByTokenHash(await sha256Hex(token));
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await storage.deleteSession(session.tokenHash);
    return null;
  }
  return storage.getUserById(session.userId);
}

/** Erro de autenticação/autorização; a mensagem é segura para exibir ao usuário. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(storage: Storage): Promise<UserRow> {
  const user = await getCurrentUser(storage);
  if (!user) throw new AuthError("Você precisa entrar para realizar esta ação.", 401);
  return user;
}

export async function requirePermission(
  storage: Storage,
  permission: Permission,
): Promise<UserRow> {
  const user = await requireUser(storage);
  if (!can(user.role, permission)) {
    throw new AuthError("Seu papel não tem permissão para esta ação.", 403);
  }
  return user;
}
