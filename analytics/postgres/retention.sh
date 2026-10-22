#!/bin/sh
# Retenção LGPD: eventos brutos 30 dias; agregados 400 dias.
# Roda no container analytics-retention (postgres:16-alpine) a cada 24 h.
set -eu

until pg_isready -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" >/dev/null 2>&1; do
  echo "[zaggo] aguardando Postgres para retenção…"
  sleep 5
done

while true; do
  psql -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM analytics.events      WHERE event_ts    < now() - interval '30 days';
DELETE FROM analytics.metrics_1m  WHERE bucket_start < now() - interval '400 days';
DELETE FROM analytics.clicks_1m   WHERE bucket_start < now() - interval '400 days';
SQL
  echo "[zaggo] retenção aplicada em $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  sleep 86400
done
