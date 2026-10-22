import { createHash } from "node:crypto";
import { appendFile, mkdir, stat, rename } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  ANALYTICS_LIMITS,
  normalizeAnalyticsBatch,
  type AnalyticsEventInput,
  type AnalyticsEventRecord,
} from "@/lib/analytics";

/**
 * Ingestão de eventos comportamentais.
 *
 * Fluxo: navegador → POST /api/track → validação/anonimização → Kafka
 * (`portal.events`). Se o Kafka estiver indisponível, os eventos são
 * gravados em `.data/analytics-fallback.ndjson` para reenvio posterior:
 * a telemetria nunca derruba nem bloqueia o portal.
 *
 * Privacidade: o IP só existe como hash com sal; nenhuma propriedade
 * sensível passa pela validação (`normalizeAnalyticsBatch`).
 */

const TOPIC = process.env["KAFKA_TOPIC"]?.trim() || "portal.events";
const FALLBACK_PATH = join(process.cwd(), ".data", "analytics-fallback.ndjson");
const FALLBACK_MAX_BYTES = 64 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Rate limit em memória (por IP, janela de 1 minuto)                  */
/* ------------------------------------------------------------------ */

const RATE_LIMIT_PER_MIN = 600;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    if (rateBuckets.size > 5_000) {
      for (const [k, v] of rateBuckets) if (v.resetAt <= now) rateBuckets.delete(k);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_PER_MIN;
}

/* ------------------------------------------------------------------ */
/* Sessão / usuário (resolvido no servidor, nunca confiado ao cliente) */
/* ------------------------------------------------------------------ */

interface SessionUser {
  id: string;
  role: string;
}

const sessionCache = new Map<string, { user: SessionUser | null; exp: number }>();
const SESSION_CACHE_TTL = 60_000;

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  return createHash("sha256").update(value).digest("hex");
}

async function resolveSessionUser(request: Request): Promise<SessionUser | null> {
  const token = cookieValue(request.headers.get("cookie"), "geos_session");
  if (!token) return null;
  const tokenHash = await sha256Hex(token);

  const cached = sessionCache.get(tokenHash);
  if (cached && cached.exp > Date.now()) return cached.user;

  let user: SessionUser | null = null;
  try {
    const { getStorage } = await import("./storage");
    const storage = await getStorage();
    const session = await storage.getSessionByTokenHash(tokenHash);
    if (session && new Date(session.expiresAt).getTime() > Date.now()) {
      const row = await storage.getUserById(session.userId);
      if (row) user = { id: row.id, role: row.role };
    }
  } catch {
    user = null;
  }

  if (sessionCache.size > 2_000) sessionCache.clear();
  sessionCache.set(tokenHash, { user, exp: Date.now() + SESSION_CACHE_TTL });
  return user;
}

/* ------------------------------------------------------------------ */
/* Contexto técnico anonimizado                                        */
/* ------------------------------------------------------------------ */

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

async function hashIp(ip: string): Promise<string | null> {
  if (!ip || ip === "unknown") return null;
  const salt =
    process.env["ANALYTICS_IP_SALT"]?.trim() ||
    process.env["AUTH_PEPPER"]?.trim() ||
    "zaggo-analytics";
  return (await sha256Hex(`${salt}:${ip}`)).slice(0, 32);
}

function uaFamily(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Other";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Other";
  return `${browser}/${os}`;
}

/* ------------------------------------------------------------------ */
/* Kafka (lazy singleton, com circuit breaker)                         */
/* ------------------------------------------------------------------ */

type KafkaProducer = {
  send: (args: { topic: string; messages: Array<{ key: string; value: string }> }) => Promise<unknown>;
};

let producerPromise: Promise<KafkaProducer | null> | null = null;
let producerFailedAt = 0;

async function getProducer(): Promise<KafkaProducer | null> {
  const brokers = (process.env["KAFKA_BROKERS"] ?? "").trim();
  if (!brokers) return null;
  if (Date.now() - producerFailedAt < 30_000) return null;

  if (!producerPromise) {
    producerPromise = (async () => {
      try {
        const { Kafka, logLevel } = await import("kafkajs");
        const kafka = new Kafka({
          clientId: "zaggo-portal",
          brokers: brokers.split(",").map((b) => b.trim()).filter(Boolean),
          logLevel: logLevel.ERROR,
          retry: { retries: 3, initialRetryTime: 200, maxRetryTime: 2000 },
          connectionTimeout: 3000,
          requestTimeout: 5000,
        });
        const producer = kafka.producer({
          allowAutoTopicCreation: false,
          idempotent: true,
          maxInFlightRequests: 1,
        });
        await producer.connect();
        console.info("[analytics] Kafka conectado:", brokers);
        return producer as unknown as KafkaProducer;
      } catch (error) {
        producerFailedAt = Date.now();
        producerPromise = null;
        console.warn(
          "[analytics] Kafka indisponível; usando fallback local:",
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    })();
  }
  return producerPromise;
}

async function writeFallback(records: AnalyticsEventRecord[]): Promise<void> {
  try {
    await mkdir(dirname(FALLBACK_PATH), { recursive: true });
    try {
      const info = await stat(FALLBACK_PATH);
      if (info.size > FALLBACK_MAX_BYTES) {
        await rename(FALLBACK_PATH, `${FALLBACK_PATH}.1`);
      }
    } catch {
      /* arquivo ainda não existe */
    }
    const lines = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
    await appendFile(FALLBACK_PATH, lines, "utf8");
  } catch (error) {
    console.warn("[analytics] falha ao gravar fallback:", error);
  }
}

async function publish(records: AnalyticsEventRecord[]): Promise<void> {
  if (records.length === 0) return;
  const producer = await getProducer();
  if (!producer) {
    await writeFallback(records);
    return;
  }
  try {
    await producer.send({
      topic: TOPIC,
      messages: records.map((record) => ({
        key: record.sessionId,
        value: JSON.stringify(record),
      })),
    });
  } catch (error) {
    producerFailedAt = Date.now();
    producerPromise = null;
    console.warn(
      "[analytics] envio ao Kafka falhou; usando fallback:",
      error instanceof Error ? error.message : error,
    );
    await writeFallback(records);
  }
}

/* ------------------------------------------------------------------ */
/* Handler HTTP                                                        */
/* ------------------------------------------------------------------ */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function noContent(): Response {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

function corsHeaders(request: Request): Record<string, string> {
  // Same-origin apenas: o endpoint não é uma API pública.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return {};
    } catch {
      return {};
    }
  }
  return { "access-control-allow-origin": origin ?? "same-origin" };
}

/** POST /api/track — aceita um lote JSON e responde 204 imediatamente. */
export async function handleTrackRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(request),
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      },
    });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Desligado explicitamente (ex.: ambiente local sem stack analítica).
  if (process.env["ANALYTICS_ENABLED"] === "0") return noContent();

  const ip = clientIp(request);
  if (rateLimited(ip)) return json({ error: "rate_limited" }, 429);

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > ANALYTICS_LIMITS.maxBodyBytes) return json({ error: "payload_too_large" }, 413);

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > ANALYTICS_LIMITS.maxBodyBytes) return json({ error: "payload_too_large" }, 413);
    raw = JSON.parse(text);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const events: AnalyticsEventInput[] = normalizeAnalyticsBatch(raw);
  if (events.length === 0) return noContent();

  const [user, ipHash, ua] = await Promise.all([
    resolveSessionUser(request),
    hashIp(ip),
    Promise.resolve(uaFamily(request.headers.get("user-agent"))),
  ]);

  const serverTs = new Date().toISOString();
  const records: AnalyticsEventRecord[] = events.map((event) => ({
    ...event,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    serverTs,
    ipHash,
    uaFamily: ua,
  }));

  // Não aguarda o Kafka: a resposta é imediata; erros caem no fallback.
  void publish(records);

  return noContent();
}

/* ------------------------------------------------------------------ */
/* Consulta agregada para o painel /analytics (polling de 10s)         */
/* ------------------------------------------------------------------ */

type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

let pgPoolPromise: Promise<PgPool | null> | null = null;

async function getPgPool(): Promise<PgPool | null> {
  const url =
    process.env["ANALYTICS_DATABASE_URL"]?.trim() ||
    process.env["POSTGRES_URL"]?.trim() ||
    process.env["DATABASE_URL"]?.trim();
  if (!url || !/^postgres(ql)?:\/\//i.test(url)) return null;

  if (!pgPoolPromise) {
    pgPoolPromise = (async () => {
      try {
        const { Pool } = await import("pg");
        const pool = new Pool({
          connectionString: url,
          max: 2,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        });
        await pool.query("select 1");
        return pool as unknown as PgPool;
      } catch (error) {
        console.warn("[analytics] Postgres indisponível:", error);
        return null;
      }
    })();
  }
  return pgPoolPromise;
}

const summaryCache = new Map<string, { body: unknown; exp: number }>();
const SUMMARY_TTL = 8_000;

const ALLOWED_ROLES = new Set(["admin", "diretor", "gestor", "auditor"]);

/** GET /api/analytics/summary?minutes=60 — restrito a papéis de gestão. */
export async function handleAnalyticsSummaryRequest(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const user = await resolveSessionUser(request);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!ALLOWED_ROLES.has(user.role)) return json({ error: "forbidden" }, 403);

  const url = new URL(request.url);
  const minutes = Math.min(1440, Math.max(5, Number(url.searchParams.get("minutes") ?? "60") || 60));
  const cacheKey = `summary:${minutes}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && cached.exp > Date.now()) {
    return new Response(JSON.stringify(cached.body), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const pool = await getPgPool();
  if (!pool) {
    return json({ enabled: false, reason: "analytics_database_unavailable" });
  }

  try {
    const [kpis, timeseries, pages, clicks, recent, funnel, roles, activeUsers] = await Promise.all([
      pool.query(
        `select
           count(*)::bigint as events,
           count(distinct session_id)::bigint as sessions,
           count(distinct user_id)::bigint as users,
           coalesce(avg(duration_ms) filter (where event = 'page_leave'), 0)::float as avg_duration_ms,
           coalesce(avg(scroll_pct) filter (where event = 'page_leave'), 0)::float as avg_scroll_pct,
           count(*) filter (where event = 'rage_click')::bigint as rage_clicks
         from analytics.events
         where event_ts >= now() - ($1::int || ' minutes')::interval`,
        [minutes],
      ),
      pool.query(
        `select date_trunc('minute', event_ts) as bucket,
                count(*)::bigint as events,
                count(distinct session_id)::bigint as sessions
         from analytics.events
         where event_ts >= now() - ($1::int || ' minutes')::interval
         group by 1 order by 1`,
        [minutes],
      ),
      pool.query(
        `select path,
                count(*)::bigint as views,
                count(distinct session_id)::bigint as sessions
         from analytics.events
         where event = 'page_view' and event_ts >= now() - ($1::int || ' minutes')::interval
         group by 1 order by 2 desc limit 8`,
        [minutes],
      ),
      pool.query(
        `select element,
                count(*)::bigint as clicks,
                count(*) filter (where event = 'rage_click')::bigint as rage_clicks
         from analytics.events
         where event in ('click','rage_click') and element is not null
           and event_ts >= now() - ($1::int || ' minutes')::interval
         group by 1 order by 2 desc limit 8`,
        [minutes],
      ),
      pool.query(
        `select event, path, role, device, event_ts
         from analytics.events
         where event_ts >= now() - interval '10 minutes'
         order by event_ts desc limit 15`,
      ),
      pool.query(
        `with s as (
           select session_id,
             bool_or(event = 'page_view') as viewed,
             bool_or(event = 'task_open') as opened_task,
             bool_or(event = 'task_create') as created_task,
             bool_or(event = 'task_move') as moved_task
           from analytics.events
           where event_ts >= now() - interval '24 hours'
           group by session_id
         )
         select 'Visualizou' as step, count(*) filter (where viewed)::bigint as sessions from s
         union all
         select 'Abriu tarefa', count(*) filter (where viewed and opened_task)::bigint from s
         union all
         select 'Criou tarefa', count(*) filter (where viewed and created_task)::bigint from s
         union all
         select 'Moveu tarefa', count(*) filter (where viewed and moved_task)::bigint from s`,
      ),
      pool.query(
        `select coalesce(role, 'anon') as role,
                count(*)::bigint as events,
                count(distinct session_id)::bigint as sessions,
                count(distinct user_id)::bigint as users
         from analytics.events
         where event_ts >= now() - ($1::int || ' minutes')::interval
         group by 1
         order by sessions desc, events desc`,
        [minutes],
      ),
      pool.query(
        `select user_id,
                (array_agg(role order by event_ts desc))[1] as role,
                count(*)::bigint as events,
                count(distinct session_id)::bigint as sessions,
                max(event_ts) as last_seen
         from analytics.events
         where user_id is not null
           and event_ts >= now() - ($1::int || ' minutes')::interval
         group by user_id
         order by sessions desc, events desc
         limit 12`,
        [minutes],
      ),
    ]);

    const body = {
      enabled: true,
      generatedAt: new Date().toISOString(),
      windowMinutes: minutes,
      kpis: kpis.rows[0] ?? {},
      timeseries: timeseries.rows,
      topPages: pages.rows,
      topClicks: clicks.rows,
      recent: recent.rows,
      funnel: funnel.rows,
      roles: roles.rows,
      activeUsers: activeUsers.rows,
    };
    summaryCache.set(cacheKey, { body, exp: Date.now() + SUMMARY_TTL });
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01" || code === "3F000") {
      return json({ enabled: false, reason: "analytics_schema_missing" });
    }
    console.warn("[analytics] falha na consulta:", error);
    return json({ enabled: false, reason: "query_failed" }, 200);
  }
}
