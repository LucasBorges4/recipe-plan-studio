#!/usr/bin/env bash
# ============================================================================
# ZAGGO — setup idempotente da stack de comportamento.
#
#   npm run analytics:setup
#
# Gera .env.analytics (segredos, 600), shiro.ini do Zeppelin e garante as
# chaves de integração no .env do portal. Não sobe containers.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE=".env"
ANALYTICS_ENV=".env.analytics"
SHIRO_FILE="analytics/zeppelin/conf/shiro.ini"
NETWORK="recipe-plan-studio_default"

info() { printf '\033[1;36m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[setup]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail "docker não encontrado"
docker compose version >/dev/null 2>&1 || fail "docker compose v2 não encontrado"

# ---------------------------------------------------------------------------
# 1. Senha do Postgres do portal
# ---------------------------------------------------------------------------
read_env() {
  local key="$1" file="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- || true
}

PG_PASSWORD="$(read_env PORTAL_PG_PASSWORD "$ENV_FILE")"
if [ -z "$PG_PASSWORD" ]; then
  PG_PASSWORD="$(docker inspect portal-postgres \
    --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
    | grep '^POSTGRES_PASSWORD=' | cut -d= -f2- || true)"
fi
if [ -z "$PG_PASSWORD" ]; then
  warn "não foi possível descobrir PORTAL_PG_PASSWORD; usando o padrão do compose"
  PG_PASSWORD="portal_strong_2024"
fi

# ---------------------------------------------------------------------------
# 2. .env.analytics (não sobrescreve segredos existentes)
# ---------------------------------------------------------------------------
rand_secret() {
  openssl rand -base64 36 2>/dev/null | tr -dc 'A-Za-z0-9' | cut -c1-28
}

if [ ! -f "$ANALYTICS_ENV" ]; then
  info "criando $ANALYTICS_ENV"
  umask 077
  cat > "$ANALYTICS_ENV" <<EOF
# Gerado por scripts/setup-analytics.sh — NÃO versionar.
PORTAL_PG_PASSWORD=${PG_PASSWORD}
PG_USER=portal
PG_DB=portal
ZEPPELIN_ADMIN_USER=admin
ZEPPELIN_ADMIN_PASSWORD=$(rand_secret)
ANALYTICS_IP_SALT=$(rand_secret)
ZEPPELIN_DIST_URL=https://downloads.apache.org/zeppelin/zeppelin-0.11.2/zeppelin-0.11.2-bin-all.tgz
EOF
  chmod 600 "$ANALYTICS_ENV"
else
  info "$ANALYTICS_ENV já existe (segredos preservados)"
  # Mantém a senha do Postgres sincronizada com a real.
  if grep -q '^PORTAL_PG_PASSWORD=' "$ANALYTICS_ENV"; then
    python3 - "$ANALYTICS_ENV" "$PG_PASSWORD" <<'PY'
import sys
path, password = sys.argv[1], sys.argv[2]
lines = []
for line in open(path, encoding="utf-8").read().splitlines():
    if line.startswith("PORTAL_PG_PASSWORD="):
        line = f"PORTAL_PG_PASSWORD={password}"
    lines.append(line)
open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
PY
  else
    printf 'PORTAL_PG_PASSWORD=%s\n' "$PG_PASSWORD" >> "$ANALYTICS_ENV"
  fi
fi

ZEPPELIN_PASSWORD="$(read_env ZEPPELIN_ADMIN_PASSWORD "$ANALYTICS_ENV")"
ZEPPELIN_USER="$(read_env ZEPPELIN_ADMIN_USER "$ANALYTICS_ENV")"
IP_SALT="$(read_env ANALYTICS_IP_SALT "$ANALYTICS_ENV")"
[ -n "$ZEPPELIN_PASSWORD" ] || fail "ZEPPELIN_ADMIN_PASSWORD ausente em $ANALYTICS_ENV"
[ -n "$IP_SALT" ] || fail "ANALYTICS_IP_SALT ausente em $ANALYTICS_ENV"
ZEPPELIN_USER="${ZEPPELIN_USER:-admin}"

# ---------------------------------------------------------------------------
# 3. shiro.ini do Zeppelin (SHA-256 + auth obrigatória)
# ---------------------------------------------------------------------------
PASSWORD_HASH="$(printf '%s' "$ZEPPELIN_PASSWORD" | sha256sum | awk '{print $1}')"
info "gerando $SHIRO_FILE"
umask 077
cat > "$SHIRO_FILE" <<EOF
# Gerado por scripts/setup-analytics.sh — NÃO versionar.
# Autenticação obrigatória (exceto version/login/logout) e senha em SHA-256.
[users]
${ZEPPELIN_USER} = ${PASSWORD_HASH}, admin

[main]
sha256Matcher = org.apache.shiro.authc.credential.Sha256CredentialsMatcher
iniRealm.credentialsMatcher = \$sha256Matcher
sessionManager = org.apache.shiro.web.session.mgt.DefaultWebSessionManager
securityManager.sessionManager = \$sessionManager
securityManager.sessionManager.globalSessionTimeout = 86400000
cookie = org.apache.shiro.web.servlet.SimpleCookie
cookie.name = JSESSIONID
cookie.httpOnly = true
sessionManager.sessionIdCookie = \$cookie
shiro.loginUrl = /api/login

[roles]
admin = *

[urls]
/api/version = anon
/api/cluster/address = anon
/api/login = anon
/api/logout = anon
/api/interpreter/** = authc, roles[admin]
/api/configurations/** = authc, roles[admin]
/api/credential/** = authc, roles[admin]
/api/admin/** = authc, roles[admin]
/** = authc
EOF
chmod 600 "$SHIRO_FILE"

# ---------------------------------------------------------------------------
# 4. Integração no .env do portal
# ---------------------------------------------------------------------------
ensure_env() {
  local key="$1" value="$2"
  if [ ! -f "$ENV_FILE" ]; then
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    return
  fi
  if grep -qE "^${key}=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$value" <<'PY'
import sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
lines = []
for line in open(path, encoding="utf-8").read().splitlines():
    if line.startswith(f"{key}="):
        line = f"{key}={value}"
    lines.append(line)
open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
PY
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

ensure_env ANALYTICS_ENABLED "1"
ensure_env ANALYTICS_IP_SALT "$IP_SALT"
ensure_env KAFKA_BROKERS "127.0.0.1:9094"
ensure_env KAFKA_TOPIC "portal.events"

# ---------------------------------------------------------------------------
# 5. Pré-condições e validação
# ---------------------------------------------------------------------------
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  fail "rede docker '$NETWORK' não existe. Suba o Postgres do portal primeiro: docker compose -f docker-compose.db.yml up -d"
fi
if ! docker ps --format '{{.Names}}' | grep -qx portal-postgres; then
  warn "container portal-postgres não está rodando; a stack analítica ficará aguardando"
fi

docker compose --env-file "$ANALYTICS_ENV" -f docker-compose.analytics.yml config -q \
  || fail "docker-compose.analytics.yml inválido"

cat <<EOF

✔ Setup concluído.

Próximos passos:
  1) Suba a stack:        npm run analytics:up
  2) Reinicie o portal:   npm run deploy   (ou pm2 restart recipe-plan-studio)
  3) Gere eventos demo:   npm run analytics:demo
  4) Acompanhe:           npm run analytics:logs

Acesso ao Zeppelin (somente local):
  ssh -L 8090:127.0.0.1:8090 <usuário>@<host>
  http://localhost:8090  →  usuário: ${ZEPPELIN_USER}
  senha:   (em .env.analytics → ZEPPELIN_ADMIN_PASSWORD)

Spark UI:   http://localhost:8081  (via túnel SSH)
Painel:     https://portal.163-176-45-217.sslip.io/analytics

EOF
