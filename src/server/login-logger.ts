import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "login-attempts.jsonl");

function ensureDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "***@***";
  return `***@${email.slice(atIndex + 1)}`;
}

function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }
  return ip;
}

export interface LoginLogEntry {
  ts: string;
  email: string;
  ip: string | null;
  outcome: "success" | "failure" | "rate_limited" | "error";
  reason?: string | undefined;
  error?: string | undefined;
}

export function logLoginAttempt(entry: LoginLogEntry): void {
  try {
    ensureDir();
    const safeEntry = {
      ...entry,
      email: maskEmail(entry.email),
      ip: maskIp(entry.ip),
    };
    appendFileSync(LOG_FILE, JSON.stringify(safeEntry) + "\n", "utf-8");
  } catch {
    // nunca deve travar o login por falha de log
  }
}
