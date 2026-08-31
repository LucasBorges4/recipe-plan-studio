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

export async function n8nFetch(path: string, init: RequestInit = {}) {
  const key = n8nApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (key) headers["X-N8N-API-KEY"] = key;
  const res = await fetch(`${n8nBaseUrl()}${path}`, { ...init, headers });
  return res;
}
