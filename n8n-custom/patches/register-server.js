const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sqlite = require('node:sqlite');

const PORT = 3456;
const DB_PATH = path.join(os.homedir(), '.n8n', 'database.sqlite');

function getDb() {
  return new sqlite.DatabaseSync(DB_PATH);
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function hashPassword(plaintext) {
  const bcrypt = require('/usr/local/lib/node_modules/n8n/node_modules/.pnpm/bcryptjs@2.4.3/node_modules/bcryptjs');
  return bcrypt.hashSync(plaintext, 10);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

async function handleRegister(req, res) {
  try {
    const { email, password, firstName, lastName } = await parseBody(req);

    if (!email || !password) {
      return send(res, 400, { error: 'E-mail e senha são obrigatórios.' });
    }
    if (password.length < 6) {
      return send(res, 400, { error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return send(res, 400, { error: 'E-mail inválido.' });
    }

    const db = getDb();
    try {
      const existing = db.prepare('SELECT id FROM user WHERE email = ?').get(email.toLowerCase());
      if (existing) {
        return send(res, 409, { error: 'Este e-mail já está cadastrado.' });
      }

      const id = generateId();
      const hashedPw = hashPassword(password);
      const now = new Date().toISOString();
      const roleSlug = 'global:member';

      db.prepare(
        `INSERT INTO user (id, email, firstName, lastName, password, roleSlug, disabled, mfaEnabled, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
      ).run(id, email.toLowerCase(), firstName || '', lastName || '', hashedPw, roleSlug, now, now);

      send(res, 201, { ok: true, message: 'Conta criada com sucesso! Faça login.' });
    } finally {
      db.close();
    }
  } catch (e) {
    console.error('Register error:', e);
    send(res, 500, { error: 'Erro interno. Tente novamente.' });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/register') {
    return handleRegister(req, res);
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Register API running on http://0.0.0.0:${PORT}`);
});
