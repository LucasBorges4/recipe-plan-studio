export type N8nWorkflowShare = {
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
};

export interface N8nWorkflow {
  id: number;
  name: string;
  active: boolean;
  nodes: any[];
  connections: any;
  createdAt: string;
  updatedAt: string;
  userId: number;
  versionId: number | null;
  tags: any[];
}

export interface N8nUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface N8nWorkflowCreatePayload {
  name: string;
  nodes?: any[];
  connections?: any;
  active?: boolean;
  tags?: any[];
}

export interface N8nUserCreatePayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: "admin" | "editor" | "viewer";
}

export function n8nBaseUrl(): string {
  const fromEnv =
    typeof process !== "undefined" && process.env
      ? (process.env["N8N_URL"] ?? process.env["N8N_HOST"] ?? "").trim()
      : "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://127.0.0.1:5679";
}

export function n8nPublicUrl(): string {
  const pub =
    typeof process !== "undefined" && process.env
      ? (process.env["N8N_PUBLIC_URL"] ?? "").trim()
      : "";
  if (pub) return pub.replace(/\/$/, "");
  return n8nBaseUrl();
}

export function n8nApiKey(): string | null {
  const k =
    typeof process !== "undefined" && process.env ? (process.env["N8N_API_KEY"] ?? "").trim() : "";
  return k ? k : null;
}

export function n8nApiPath(): string {
  return "/api/v1";
}

/* ------------------------------------------------------------------ */
/* Security Hardening (REQ-013)                                        */
/* ------------------------------------------------------------------ */

const BLOCKED_NETWORKS = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "169.254.0.0/16",
  "100.64.0.0/10",
];

function parseCidr(network: string): { network: number; mask: number } {
  const [ip, bitsStr] = network.split("/");
  const bits = parseInt(bitsStr ?? "32", 10);
  const parts = ip!.split(".").map((n) => parseInt(n, 10));
  let val = 0;
  for (let i = 0; i < 4; i++) val = (val << 8) | (parts[i] ?? 0);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { network: val >>> 0, mask: mask >>> 0 };
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let val = 0;
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    val = (val << 8) | n;
  }
  return val >>> 0;
}

export function isBlockedIp(ip: string): boolean {
  if (ip === "0.0.0.0" || ip === "::") return true;
  if (ip === "127.0.0.1" || ip === "::1") return false;
  if (ip.startsWith("127.")) return false;
  const intIp = ipToInt(ip);
  if (intIp === null) return true; // não IPv4 conhecido → bloqueado por segurança
  for (const net of BLOCKED_NETWORKS) {
    const { network, mask } = parseCidr(net);
    if (((intIp >>> 0) & mask) === (network & mask)) return true;
  }
  return false;
}

export async function validateN8nUrl(
  urlStr: string,
  lookup?: (host: string) => Promise<string[]>,
): Promise<string> {
  const url = new URL(urlStr);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Protocolo não permitido: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error("Credenciais na URL não são permitidas");
  }
  if (url.port !== "" && parseInt(url.port, 10) === 0) {
    throw new Error("Porta 0 não é permitida");
  }
  const hostname = url.hostname;
  const resolved = lookup
    ? await lookup(hostname)
    : await new Promise<string[]>((resolve) => {
        try {
          const { lookup } = require("node:dns");
          lookup(hostname, { all: true }, (err: unknown, addrs: unknown) => {
            const results = Array.isArray(addrs)
              ? addrs.map((a: unknown) =>
                  typeof a === "object" && a !== null && "address" in a
                    ? String((a as Record<string, unknown>)["address"])
                    : String(a),
                )
              : [];
            resolve(results);
          });
        } catch {
          resolve([]);
        }
      });
  const ips = resolved.length > 0 ? resolved : [hostname];
  for (const ip of ips) {
    if (isBlockedIp(ip)) {
      throw new Error(`IP bloqueado: ${ip}`);
    }
  }
  const baseUrl = `${url.protocol}//${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "80")}`;
  return baseUrl;
}

export async function safeFetch(
  url: string,
  init?: RequestInit,
  timeoutMs = 10000,
  maxBodySize = 5 * 1024 * 1024,
  maxRedirects = 5,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const validated = await validateN8nUrl(url);
    const res = await fetch(validated, { ...init, signal: controller.signal, redirect: "manual" });
    clearTimeout(timer);
    if (res.status >= 300 && res.status < 400 && maxRedirects > 0) {
      const location = res.headers.get("location");
      if (!location) return res;
      if (maxRedirects <= 0) throw new Error("Máximo de redirecionamentos excedido");
      return safeFetch(
        new URL(location, validated).toString(),
        init,
        timeoutMs,
        maxBodySize,
        maxRedirects - 1,
      );
    }
    const body = await res.clone().arrayBuffer();
    if (body.byteLength > maxBodySize) throw new Error(`Corpo excede ${maxBodySize} bytes`);
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function n8nFetch(path: string, init: RequestInit = {}) {
  const key = n8nApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (key) headers["X-N8N-API-KEY"] = key;
  const res = await fetch(`${n8nBaseUrl()}${n8nApiPath()}${path}`, { ...init, headers });
  return res;
}

export async function listN8nWorkflows(): Promise<N8nWorkflow[]> {
  const res = await n8nFetch("/workflows");
  if (!res.ok) throw new Error(`n8n list failed: ${res.status}`);
  const json = (await res.json()) as { data?: N8nWorkflow[] };
  return Array.isArray(json.data) ? json.data : [];
}

export async function getN8nWorkflow(id: number): Promise<N8nWorkflow> {
  const res = await n8nFetch(`/workflows/${id}`);
  if (!res.ok) throw new Error(`n8n get failed: ${res.status}`);
  return res.json();
}

export async function createN8nWorkflow(payload: N8nWorkflowCreatePayload): Promise<N8nWorkflow> {
  const res = await n8nFetch("/workflows", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`n8n create failed: ${res.status}`);
  return res.json();
}

export async function updateN8nWorkflow(
  id: number,
  payload: N8nWorkflowCreatePayload,
): Promise<N8nWorkflow> {
  const res = await n8nFetch(`/workflows/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`n8n update failed: ${res.status}`);
  return res.json();
}

export async function deleteN8nWorkflow(id: number): Promise<void> {
  const res = await n8nFetch(`/workflows/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`n8n delete failed: ${res.status}`);
}

export interface FrameConnectivityHint {
  reachable: boolean;
  blocked: boolean;
  status?: number;
  frameHeader?: string;
  cspFrameAncestors?: boolean;
}

export async function getFrameConnectivityHint(): Promise<FrameConnectivityHint> {
  try {
    const url = n8nPublicUrl();
    // Verifica a URL pública do n8n com timeout curto (4s)
    const res = await safeFetch(url, { method: "GET" }, 4000, 5 * 1024 * 1024);
    const status = res.status;
    const frameHeader = res.headers.get("x-frame-options") || undefined;
    const cspHeader = res.headers.get("content-security-policy") || undefined;
    const cspFrameAncestors = cspHeader
      ? /frame-ancestors\s+[^;]*['"]?self['"]?/.test(cspHeader) || /frame-ancestors\s+[^;]*https?:\/\/portal\.[^;]*sslip\.io/.test(cspHeader)
      : false;
    // Bloqueado se há X-Frame-Options restritivo e NÃO há CSP frame-ancestors permissivo
    const blockedHeader = (frameHeader ?? "").toLowerCase();
    const blocked =
      (blockedHeader === "sameorigin" || blockedHeader === "deny" || blockedHeader.includes("sameorigin")) &&
      !cspFrameAncestors;
    const hint: FrameConnectivityHint = {
      reachable: true,
      blocked,
      status,
      ...(frameHeader ? { frameHeader } : {}),
      ...(cspFrameAncestors ? { cspFrameAncestors: true } : {}),
    };
    return hint;
  } catch (e) {
    // Rede falhou ou timeout
    return { reachable: false, blocked: false };
  }
}

/* ------------------------------------------------------------------ */
/* SSO Token (Fase 2 — HMAC com crypto do Node)                          */
/* ------------------------------------------------------------------ */

export interface SsoTokenPayload {
  email: string;
  fn: string;
  ln: string;
  iat: number;
  exp: number;
}

function base64urlEncode(obj: SsoTokenPayload | string): string {
  const json = typeof obj === "string" ? obj : JSON.stringify(obj);
  return Buffer.from(json)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateSsoToken(
  payload: { email: string; firstName?: string; lastName?: string },
  secret: string,
  ttlMinutes = 5,
): string {
  const { createHmac } = require("crypto");
  const now = Math.floor(Date.now() / 1000);
  const p: SsoTokenPayload = {
    email: payload.email.toLowerCase().trim(),
    fn: payload.firstName || "",
    ln: payload.lastName || "",
    iat: now,
    exp: now + ttlMinutes * 60,
  };
  const payloadB64 = base64urlEncode(p);
  const hmac = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${hmac}`;
}

export function verifySsoToken(token: string, secret: string): SsoTokenPayload | null {
  const { createHmac } = require("crypto");
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts as [string, string];
  if (!payloadB64 || !signature) return null;
  const hmac = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  if (hmac !== signature) return null;
  try {
    const payloadStr = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    const p: SsoTokenPayload = JSON.parse(payloadStr);
    if (p.exp < Math.floor(Date.now() / 1000)) return null; // expirado
    return p;
  } catch {
    return null;
  }
}

export async function provisionN8nUser(
  email: string,
  name: string,
  password?: string,
  ssoToken?: string,
): Promise<N8nUser> {
  const [firstName, ...lastParts] = name.trim().split(/\s+/);
  const lastName = lastParts.join(" ") || firstName;
  // Endpoint custom do container n8n (porta 3456, exposta via nginx)
  const registerUrl =
    process.env["N8N_REGISTRATION_URL"]?.trim() || "http://127.0.0.1:3456/register";
  const body: Record<string, unknown> = {
    email: email.toLowerCase().trim(),
    firstName: firstName || "User",
    lastName,
  };
  if (ssoToken) {
    (body as Record<string, unknown>)["ssoToken"] = ssoToken;
  } else if (password) {
    (body as Record<string, unknown>)["password"] = password;
  }
  // Se não há ssoToken nem password, não envia senha; o register-server
  // criará usuário com senha aleatória interna se receber ssoToken válido.
  const res = await fetch(registerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }) as { message?: string });
    throw new Error(`n8n provision failed: ${res.status} ${err.message ?? ""}`);
  }
  const data = (await res.json()) as {
    ok?: boolean;
    message?: string;
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    roleSlug?: string;
  };
  // O register-server retorna {ok, message}; construímos N8nUser a partir dos inputs
  return {
    id: data.id ? parseInt(data.id.replace(/[^\d]/g, "").slice(0, 8)) || 0 : 0,
    email: email.toLowerCase().trim(),
    firstName: firstName || "User",
    lastName,
    role: "global:member",
    disabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as N8nUser;
}
