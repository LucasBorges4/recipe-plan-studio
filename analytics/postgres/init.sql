-- ============================================================================
-- ZAGGO — esquema analítico (comportamento de usuários)
-- Execute no banco `portal` (mesmo Postgres do portal).
-- Idempotente: pode rodar em todo `docker compose up`.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- ---------------------------------------------------------------------------
-- Eventos brutos (pseudonimizados; retenção de 30 dias)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics.events (
  event_id      text PRIMARY KEY,
  event         text NOT NULL,
  event_ts      timestamptz NOT NULL,
  server_ts     timestamptz,
  session_id    text NOT NULL,
  anon_id       text,
  user_id       text,
  role          text,
  path          text,
  referrer      text,
  title         text,
  element       text,
  props         jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms   integer,
  scroll_pct    integer,
  viewport      text,
  lang          text,
  tz            text,
  device        text,
  ua_family     text,
  ip_hash       text,
  ingested_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_ts_idx        ON analytics.events (event_ts DESC);
CREATE INDEX IF NOT EXISTS events_session_idx   ON analytics.events (session_id);
CREATE INDEX IF NOT EXISTS events_path_idx      ON analytics.events (path);
CREATE INDEX IF NOT EXISTS events_type_idx      ON analytics.events (event);
CREATE INDEX IF NOT EXISTS events_user_idx      ON analytics.events (user_id) WHERE user_id IS NOT NULL;

-- Staging usado pelo Spark (JDBC append) antes do upsert idempotente.
CREATE TABLE IF NOT EXISTS analytics.events_stage (LIKE analytics.events INCLUDING DEFAULTS);
ALTER TABLE analytics.events_stage ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE analytics.events_stage ALTER COLUMN props DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- Agregados por minuto (retenção de 400 dias)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics.metrics_1m (
  bucket_start    timestamptz NOT NULL,
  path            text NOT NULL,
  event           text NOT NULL,
  role            text NOT NULL DEFAULT 'anon',
  device          text NOT NULL DEFAULT 'unknown',
  events          bigint NOT NULL DEFAULT 0,
  sessions        bigint NOT NULL DEFAULT 0,
  users           bigint NOT NULL DEFAULT 0,
  avg_duration_ms double precision,
  avg_scroll_pct  double precision,
  rage_clicks     bigint NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_start, path, event, role, device)
);

CREATE TABLE IF NOT EXISTS analytics.metrics_1m_stage (LIKE analytics.metrics_1m INCLUDING DEFAULTS);
ALTER TABLE analytics.metrics_1m_stage ALTER COLUMN bucket_start DROP NOT NULL;

CREATE INDEX IF NOT EXISTS metrics_1m_bucket_idx ON analytics.metrics_1m (bucket_start DESC);

CREATE TABLE IF NOT EXISTS analytics.clicks_1m (
  bucket_start timestamptz NOT NULL,
  element      text NOT NULL,
  path         text NOT NULL,
  clicks       bigint NOT NULL DEFAULT 0,
  rage_clicks  bigint NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_start, element, path)
);

CREATE TABLE IF NOT EXISTS analytics.clicks_1m_stage (LIKE analytics.clicks_1m INCLUDING DEFAULTS);
ALTER TABLE analytics.clicks_1m_stage ALTER COLUMN bucket_start DROP NOT NULL;

CREATE INDEX IF NOT EXISTS clicks_1m_bucket_idx ON analytics.clicks_1m (bucket_start DESC);

-- ---------------------------------------------------------------------------
-- Views para os dashboards do Zeppelin e consultas ad-hoc
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW analytics.v_live_kpis AS
SELECT
  count(*)::bigint                                          AS events,
  count(DISTINCT session_id)::bigint                        AS sessions,
  count(DISTINCT user_id)::bigint                           AS users,
  coalesce(avg(duration_ms) FILTER (WHERE event = 'page_leave'), 0)::numeric(12,1) AS avg_duration_ms,
  coalesce(avg(scroll_pct) FILTER (WHERE event = 'page_leave'), 0)::numeric(12,1) AS avg_scroll_pct,
  count(*) FILTER (WHERE event = 'rage_click')::bigint      AS rage_clicks,
  count(*) FILTER (WHERE event = 'page_view')::bigint       AS page_views
FROM analytics.events
WHERE event_ts >= now() - interval '5 minutes';

CREATE OR REPLACE VIEW analytics.v_events_per_minute AS
SELECT
  date_trunc('minute', event_ts) AS bucket,
  count(*)::bigint               AS events,
  count(DISTINCT session_id)::bigint AS sessions,
  count(*) FILTER (WHERE event = 'page_view')::bigint AS page_views,
  count(*) FILTER (WHERE event = 'rage_click')::bigint AS rage_clicks
FROM analytics.events
WHERE event_ts >= now() - interval '60 minutes'
GROUP BY 1
ORDER BY 1;

CREATE OR REPLACE VIEW analytics.v_top_pages_15m AS
SELECT
  path,
  count(*) FILTER (WHERE event = 'page_view')::bigint AS views,
  count(DISTINCT session_id)::bigint                  AS sessions,
  round(avg(duration_ms) FILTER (WHERE event = 'page_leave'))::bigint AS avg_dwell_ms,
  round(avg(scroll_pct) FILTER (WHERE event = 'page_leave'))::bigint  AS avg_scroll_pct
FROM analytics.events
WHERE event_ts >= now() - interval '15 minutes'
GROUP BY path
HAVING count(*) FILTER (WHERE event = 'page_view') > 0
ORDER BY views DESC
LIMIT 20;

CREATE OR REPLACE VIEW analytics.v_click_heatmap_15m AS
SELECT
  element,
  path,
  count(*) FILTER (WHERE event = 'click')::bigint      AS clicks,
  count(*) FILTER (WHERE event = 'rage_click')::bigint AS rage_clicks,
  round(100.0 * count(*) FILTER (WHERE event = 'rage_click')
        / greatest(count(*), 1), 1)                    AS rage_rate_pct
FROM analytics.events
WHERE event IN ('click', 'rage_click')
  AND element IS NOT NULL
  AND event_ts >= now() - interval '15 minutes'
GROUP BY element, path
ORDER BY clicks DESC
LIMIT 25;

CREATE OR REPLACE VIEW analytics.v_funnel_24h AS
WITH s AS (
  SELECT
    session_id,
    bool_or(event = 'page_view')   AS viewed,
    bool_or(event = 'task_open')   AS opened_task,
    bool_or(event = 'task_create') AS created_task,
    bool_or(event = 'task_move')   AS moved_task,
    bool_or(event = 'search')      AS searched
  FROM analytics.events
  WHERE event_ts >= now() - interval '24 hours'
  GROUP BY session_id
)
SELECT '1. Visualizou o portal' AS step, count(*) FILTER (WHERE viewed)::bigint AS sessions FROM s
UNION ALL
SELECT '2. Usou a busca', count(*) FILTER (WHERE viewed AND searched)::bigint FROM s
UNION ALL
SELECT '3. Abriu uma tarefa', count(*) FILTER (WHERE viewed AND opened_task)::bigint FROM s
UNION ALL
SELECT '4. Criou uma tarefa', count(*) FILTER (WHERE viewed AND created_task)::bigint FROM s
UNION ALL
SELECT '5. Moveu uma tarefa', count(*) FILTER (WHERE viewed AND moved_task)::bigint FROM s;

CREATE OR REPLACE VIEW analytics.v_device_breakdown_15m AS
SELECT
  coalesce(device, 'unknown') AS device,
  count(*)::bigint            AS events,
  count(DISTINCT session_id)::bigint AS sessions
FROM analytics.events
WHERE event_ts >= now() - interval '15 minutes'
GROUP BY 1
ORDER BY events DESC;

CREATE OR REPLACE VIEW analytics.v_role_activity_15m AS
SELECT
  coalesce(role, 'anon') AS role,
  count(*)::bigint       AS events,
  count(DISTINCT session_id)::bigint AS sessions,
  count(DISTINCT user_id)::bigint    AS users
FROM analytics.events
WHERE event_ts >= now() - interval '15 minutes'
GROUP BY 1
ORDER BY events DESC;

CREATE OR REPLACE VIEW analytics.v_user_activity_15m AS
SELECT
  user_id,
  (array_agg(role ORDER BY event_ts DESC))[1] AS role,
  count(*)::bigint                   AS events,
  count(DISTINCT session_id)::bigint AS sessions,
  max(event_ts)                      AS last_seen
FROM analytics.events
WHERE user_id IS NOT NULL
  AND event_ts >= now() - interval '15 minutes'
GROUP BY user_id
ORDER BY sessions DESC, events DESC
LIMIT 50;

CREATE OR REPLACE VIEW analytics.v_slow_pages_15m AS
SELECT
  path,
  count(*)::bigint AS leaves,
  round(avg(duration_ms))::bigint AS avg_dwell_ms,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_ms)::bigint AS p90_dwell_ms,
  round(avg(scroll_pct))::bigint AS avg_scroll_pct
FROM analytics.events
WHERE event = 'page_leave'
  AND event_ts >= now() - interval '15 minutes'
GROUP BY path
HAVING count(*) >= 3
ORDER BY avg_dwell_ms DESC
LIMIT 15;
