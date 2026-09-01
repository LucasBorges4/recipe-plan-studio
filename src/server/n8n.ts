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
    typeof process !== "undefined" && process.env
      ? (process.env["N8N_API_KEY"] ?? "").trim()
      : "";
  return k ? k : null;
}

export function n8nApiPath(): string {
  return "/api/v1";
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
  const res = await n8nFetch("");
  if (!res.ok) throw new Error(`n8n list failed: ${res.status}`);
  return res.json();
}

export async function getN8nWorkflow(id: number): Promise<N8nWorkflow> {
  const res = await n8nFetch(`/${id}`);
  if (!res.ok) throw new Error(`n8n get failed: ${res.status}`);
  return res.json();
}

export async function createN8nWorkflow(
  payload: N8nWorkflowCreatePayload,
): Promise<N8nWorkflow> {
  const res = await n8nFetch("", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`n8n create failed: ${res.status}`);
  return res.json();
}

export async function updateN8nWorkflow(
  id: number,
  payload: N8nWorkflowCreatePayload,
): Promise<N8nWorkflow> {
  const res = await n8nFetch(`/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`n8n update failed: ${res.status}`);
  return res.json();
}

export async function deleteN8nWorkflow(id: number): Promise<void> {
  const res = await n8nFetch(`/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`n8n delete failed: ${res.status}`);
}

export async function provisionN8nUser(
  email: string,
  name: string,
  password: string,
): Promise<N8nUser> {
  const [firstName, ...lastParts] = name.trim().split(/\s+/);
  const lastName = lastParts.join(" ") || firstName;
  const res = await n8nFetch("/users", {
    method: "POST",
    body: JSON.stringify({ email, password, firstName: firstName || "User", lastName, role: "editor" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`n8n provision failed: ${res.status} ${err.message ?? ""}`);
  }
  return res.json();
}
