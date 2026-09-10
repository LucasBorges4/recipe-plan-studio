import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "login-attempts.jsonl");

function ensureDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export interface LoginLogEntry {
  ts: string;
  email: string;
  ip: string | null;
  outcome: "success" | "failure" | "rate_limited" | "error";
  reason?: string;
  userFound?: boolean;
  passwordValid?: boolean;
  pepperSource?: "env" | "meta";
  passwordHashPrefix?: string;
  error?: string;
}

export function logLoginAttempt(entry: LoginLogEntry): void {
  try {
    ensureDir();
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // nunca deve travar o login por falha de log
  }
}
