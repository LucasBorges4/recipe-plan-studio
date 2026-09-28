const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");
const sqlite = require("node:sqlite");

const PORT = 3456;
const DB_PATH = path.join(os.homedir(), ".n8n", "database.sqlite");

function getDb() {
  return new sqlite.DatabaseSync(DB_PATH);
}

function generateId() {
  return require("crypto").randomUUID();
}

function generateProjectId() {
  const crypto = require("crypto");
  const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(crypto.randomBytes(17))
    .map((b) => ALPHA[b % ALPHA.length])
    .join("");
}

function hashPassword(plaintext) {
  const bcrypt = require("/usr/local/lib/node_modules/n8n/node_modules/.pnpm/bcryptjs@2.4.3/node_modules/bcryptjs");
  return bcrypt.hashSync(plaintext, 10);
}

const ALLOWED_ORIGINS = new Set([
  "https://163.176.45.217.sslip.io",
  "https://163-176-45-217.sslip.io",
  "https://portal.163-176-45-217.sslip.io",
  "https://portal.163-176-45-217.sslip.io",
]);

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://163-176-45-217.sslip.io";
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

const MAX_BODY_BYTES = 4096;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, data, origin) {
  res.writeHead(status, corsHeaders(origin));
  res.end(JSON.stringify(data));
}

function verifySsoToken(token, secret) {
  try {
    const crypto = require("crypto");
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const hmac = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
    if (hmac !== signature) return null;
    const payloadStr = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    const p = JSON.parse(payloadStr);
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

function generateRandomPassword() {
  const bytes = require("crypto").randomBytes(24);
  return bytes.toString("base64url").slice(0, 24);
}

async function handleRegister(req, res) {
  const origin = req.headers.origin;
  try {
    const { email, password, firstName, lastName, ssoToken } = await parseBody(req);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return send(res, 400, { error: "E-mail inválido." }, origin);
    }

    const secret = (process.env["N8N_SSO_SECRET"] || "").trim();
    let validatedToken = null;

    if (ssoToken) {
      if (!secret) {
        return send(res, 500, { error: "SSO não configurado (N8N_SSO_SECRET vazio)." }, origin);
      }
      validatedToken = verifySsoToken(ssoToken, secret);
      if (!validatedToken) {
        return send(res, 401, { error: "Token SSO inválido ou expirado." }, origin);
      }
      // Garante que o e-mail no token corresponde ao registro
      if (validatedToken.email.toLowerCase() !== email.toLowerCase()) {
        return send(res, 401, { error: "Token SSO não corresponde ao e-mail informado." }, origin);
      }
    }

    if (!ssoToken && !password) {
      return send(res, 400, { error: "E-mail e senha (ou token SSO) são obrigatórios." }, origin);
    }

    if (password && password.length < 10) {
      return send(res, 400, { error: "A senha deve ter pelo menos 10 caracteres." }, origin);
    }

    const db = getDb();
    try {
      const existing = db.prepare("SELECT id FROM user WHERE email = ?").get(email.toLowerCase());
      if (existing) {
        return send(res, 409, { error: "Este e-mail já está cadastrado." }, origin);
      }

      const id = generateId();
      const hashedPw = ssoToken ? hashPassword(generateRandomPassword()) : hashPassword(password);
      const now = new Date().toISOString();
      const roleSlug = "global:member";

      db.prepare(
        `INSERT INTO user (id, email, firstName, lastName, password, roleSlug, disabled, mfaEnabled, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      ).run(id, email.toLowerCase(), firstName || "", lastName || "", hashedPw, roleSlug, now, now);

      // Cria o projeto pessoal do usuario (exigido pelo n8n no pos-login)
      const projectId = generateProjectId();
      const projectName =
        [firstName, lastName].filter(Boolean).join(" ") + " <" + email.toLowerCase() + ">";
      db.prepare(
        "INSERT INTO project (id, name, type, createdAt, updatedAt, icon, description, creatorId) VALUES (?, ?, 'personal', ?, ?, NULL, NULL, ?)",
      ).run(projectId, projectName, now, now, id);
      db.prepare(
        "INSERT INTO project_relation (projectId, userId, role, createdAt, updatedAt) VALUES (?, ?, 'project:personalOwner', ?, ?)",
      ).run(projectId, id, now, now);

      send(res, 201, { ok: true, message: "Conta criada com sucesso! Faça login." }, origin);
    } finally {
      db.close();
    }
  } catch (e) {
    console.error("Register error:", e);
    send(res, 500, { error: "Erro interno. Tente novamente." }, origin);
  }
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  if (req.method === "POST" && req.url === "/register") {
    return handleRegister(req, res);
  }

  send(res, 404, { error: "Not found" }, origin);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Register API running on http://0.0.0.0:${PORT}`);
});
