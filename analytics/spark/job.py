"""
ZAGGO — Job de streaming comportamental.

Kafka (portal.events) → Spark Structured Streaming → PostgreSQL (analytics.*)
  • eventos brutos com deduplicação idempotente
  • agregados por minuto (eventos, sessões, usuários, dwell, scroll, rage clicks)
  • cliques e rage clicks por elemento/página

Executado em cluster Spark standalone (driver no container spark-job).
"""

import os
import sys
import time

import psycopg2
from pyspark.sql import SparkSession, functions as F
from pyspark.sql.types import (
    IntegerType,
    StringType,
    StructField,
    StructType,
)

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "kafka:9092")
KAFKA_TOPIC = os.environ.get("KAFKA_TOPIC", "portal.events")
CHECKPOINT_DIR = os.environ.get("CHECKPOINT_DIR", "/opt/spark/work-dir/checkpoints")

PG_HOST = os.environ.get("PG_HOST", "portal-postgres")
PG_PORT = os.environ.get("PG_PORT", "5432")
PG_DB = os.environ.get("PG_DB", "portal")
PG_USER = os.environ.get("PG_USER", "portal")
PG_PASSWORD = os.environ.get("PG_PASSWORD", "")

JDBC_URL = f"jdbc:postgresql://{PG_HOST}:{PG_PORT}/{PG_DB}?stringtype=unspecified"
JDBC_PROPS = {
    "user": PG_USER,
    "password": PG_PASSWORD,
    "driver": "org.postgresql.Driver",
    "stringtype": "unspecified",
}

EVENT_SCHEMA = StructType(
    [
        StructField("id", StringType()),
        StructField("type", StringType()),
        StructField("ts", StringType()),
        StructField("path", StringType()),
        StructField("title", StringType()),
        StructField("referrer", StringType()),
        StructField("sessionId", StringType()),
        StructField("anonId", StringType()),
        StructField("element", StringType()),
        StructField("durationMs", IntegerType()),
        StructField("scrollPct", IntegerType()),
        StructField("viewport", StringType()),
        StructField("lang", StringType()),
        StructField("tz", StringType()),
        StructField("device", StringType()),
        StructField("userId", StringType()),
        StructField("role", StringType()),
        StructField("serverTs", StringType()),
        StructField("ipHash", StringType()),
        StructField("uaFamily", StringType()),
    ]
)

VALID_EVENTS = (
    "page_view",
    "page_leave",
    "click",
    "rage_click",
    "scroll_depth",
    "search",
    "filter_change",
    "form_submit",
    "task_open",
    "task_create",
    "task_move",
    "login",
    "logout",
    "error",
    "export",
    "download",
    "custom",
)


def pg_connection():
    """Conexão direta ao Postgres para o upsert idempotente pós-JDBC."""
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        dbname=PG_DB,
        user=PG_USER,
        password=PG_PASSWORD,
        connect_timeout=10,
        application_name="zaggo-spark-streaming",
    )


def write_events(batch_df, batch_id: int) -> None:
    """Grava o lote bruto em staging e faz INSERT ... ON CONFLICT DO NOTHING."""
    if batch_df.rdd.isEmpty():
        return

    out = batch_df.select(
        F.col("id").alias("event_id"),
        F.col("type").alias("event"),
        F.col("event_ts"),
        F.col("server_ts"),
        F.col("sessionId").alias("session_id"),
        F.col("anonId").alias("anon_id"),
        F.col("userId").alias("user_id"),
        F.col("role"),
        F.col("path"),
        F.col("referrer"),
        F.col("title"),
        F.coalesce(F.col("props_json"), F.lit("{}")).alias("props"),
        F.col("durationMs").alias("duration_ms"),
        F.col("scrollPct").alias("scroll_pct"),
        F.col("viewport"),
        F.col("lang"),
        F.col("tz"),
        F.col("device"),
        F.col("uaFamily").alias("ua_family"),
        F.col("ipHash").alias("ip_hash"),
    )

    out.write.mode("append").option("truncate", "true").jdbc(
        JDBC_URL, "analytics.events_stage", properties=JDBC_PROPS
    )

    with pg_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO analytics.events (
              event_id, event, event_ts, server_ts, session_id, anon_id, user_id,
              role, path, referrer, title, props, duration_ms, scroll_pct,
              viewport, lang, tz, device, ua_family, ip_hash
            )
            SELECT
              event_id, event, event_ts, server_ts, session_id, anon_id, user_id,
              role, path, referrer, title, coalesce(props, '{}')::jsonb, duration_ms,
              scroll_pct, viewport, lang, tz, device, ua_family, ip_hash
            FROM analytics.events_stage
            ON CONFLICT (event_id) DO NOTHING
            """
        )
        cur.execute("TRUNCATE analytics.events_stage")
        conn.commit()
    print(f"[events] batch {batch_id}: gravado", flush=True)


def write_metrics(batch_df, batch_id: int) -> None:
    """Upsert dos agregados de 1 minuto."""
    if batch_df.rdd.isEmpty():
        return

    out = batch_df.select(
        F.col("w.start").alias("bucket_start"),
        F.col("path"),
        F.col("type").alias("event"),
        F.col("role"),
        F.col("device"),
        F.col("events"),
        F.col("sessions"),
        F.col("users"),
        F.col("avg_duration_ms"),
        F.col("avg_scroll_pct"),
        F.col("rage_clicks"),
    )

    out.write.mode("append").option("truncate", "true").jdbc(
        JDBC_URL, "analytics.metrics_1m_stage", properties=JDBC_PROPS
    )

    with pg_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO analytics.metrics_1m AS m (
              bucket_start, path, event, role, device, events, sessions, users,
              avg_duration_ms, avg_scroll_pct, rage_clicks, updated_at
            )
            SELECT
              bucket_start, path, event, role, device, events, sessions, users,
              avg_duration_ms, avg_scroll_pct, rage_clicks, now()
            FROM analytics.metrics_1m_stage
            ON CONFLICT (bucket_start, path, event, role, device) DO UPDATE SET
              events = EXCLUDED.events,
              sessions = EXCLUDED.sessions,
              users = EXCLUDED.users,
              avg_duration_ms = EXCLUDED.avg_duration_ms,
              avg_scroll_pct = EXCLUDED.avg_scroll_pct,
              rage_clicks = EXCLUDED.rage_clicks,
              updated_at = now()
            """
        )
        cur.execute("TRUNCATE analytics.metrics_1m_stage")
        conn.commit()
    print(f"[metrics] batch {batch_id}: agregado", flush=True)


def write_clicks(batch_df, batch_id: int) -> None:
    if batch_df.rdd.isEmpty():
        return

    out = batch_df.select(
        F.col("w.start").alias("bucket_start"),
        F.col("element"),
        F.col("path"),
        F.col("clicks"),
        F.col("rage_clicks"),
    )

    out.write.mode("append").option("truncate", "true").jdbc(
        JDBC_URL, "analytics.clicks_1m_stage", properties=JDBC_PROPS
    )

    with pg_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO analytics.clicks_1m AS c (
              bucket_start, element, path, clicks, rage_clicks, updated_at
            )
            SELECT bucket_start, element, path, clicks, rage_clicks, now()
            FROM analytics.clicks_1m_stage
            WHERE element IS NOT NULL
            ON CONFLICT (bucket_start, element, path) DO UPDATE SET
              clicks = EXCLUDED.clicks,
              rage_clicks = EXCLUDED.rage_clicks,
              updated_at = now()
            """
        )
        cur.execute("TRUNCATE analytics.clicks_1m_stage")
        conn.commit()
    print(f"[clicks] batch {batch_id}: agregado", flush=True)


def main() -> None:
    spark = (
        SparkSession.builder.appName("zaggo-behavior-stream")
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.streaming.stopGracefullyOnShutdown", "true")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    raw = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BROKERS)
        .option("subscribe", KAFKA_TOPIC)
        .option("startingOffsets", "earliest")
        .option("failOnDataLoss", "false")
        .load()
    )

    parsed = raw.select(
        F.from_json(F.col("value").cast("string"), EVENT_SCHEMA).alias("e"),
        F.col("value").cast("string").alias("raw"),
    ).select("e.*", F.get_json_object("raw", "$.props").alias("props_json"))

    events = (
        parsed.withColumn("event_ts", F.to_timestamp("ts"))
        .withColumn("server_ts", F.to_timestamp("serverTs"))
        .filter(F.col("id").isNotNull())
        .filter(F.col("event_ts").isNotNull())
        .filter(F.col("sessionId").isNotNull())
        .filter(F.col("type").isin(*VALID_EVENTS))
        .select(
            "id",
            "type",
            "event_ts",
            "server_ts",
            "sessionId",
            "anonId",
            "userId",
            "role",
            "path",
            "referrer",
            "title",
            "element",
            "props_json",
            "durationMs",
            "scrollPct",
            "viewport",
            "lang",
            "tz",
            "device",
            "uaFamily",
            "ipHash",
        )
    )

    watermark = "10 minutes"

    # 1) Eventos brutos
    q_events = (
        events.writeStream.foreachBatch(write_events)
        .option("checkpointLocation", f"{CHECKPOINT_DIR}/events-v1")
        .trigger(processingTime="10 seconds")
        .start()
    )

    # 2) Agregados por minuto (update = upsert em janelas ainda abertas)
    agg = (
        events.withWatermark("event_ts", watermark)
        .groupBy(
            F.window("event_ts", "1 minute").alias("w"),
            F.col("path"),
            F.col("type"),
            F.coalesce(F.col("role"), F.lit("anon")).alias("role"),
            F.coalesce(F.col("device"), F.lit("unknown")).alias("device"),
        )
        .agg(
            F.count("*").alias("events"),
            F.approx_count_distinct("sessionId").alias("sessions"),
            F.approx_count_distinct("userId").alias("users"),
            F.avg(F.when(F.col("type") == "page_leave", F.col("durationMs"))).alias(
                "avg_duration_ms"
            ),
            F.avg(F.when(F.col("type") == "page_leave", F.col("scrollPct"))).alias(
                "avg_scroll_pct"
            ),
            F.sum(F.when(F.col("type") == "rage_click", 1).otherwise(0)).alias("rage_clicks"),
        )
    )

    q_metrics = (
        agg.writeStream.outputMode("update")
        .foreachBatch(write_metrics)
        .option("checkpointLocation", f"{CHECKPOINT_DIR}/metrics-v1")
        .trigger(processingTime="15 seconds")
        .start()
    )

    # 3) Cliques / rage clicks por elemento
    clicks = (
        events.filter(F.col("type").isin("click", "rage_click"))
        .filter(F.col("element").isNotNull())
        .withWatermark("event_ts", watermark)
        .groupBy(
            F.window("event_ts", "1 minute").alias("w"),
            F.col("element"),
            F.col("path"),
        )
        .agg(
            F.sum(F.when(F.col("type") == "click", 1).otherwise(0)).alias("clicks"),
            F.sum(F.when(F.col("type") == "rage_click", 1).otherwise(0)).alias("rage_clicks"),
        )
    )

    q_clicks = (
        clicks.writeStream.outputMode("update")
        .foreachBatch(write_clicks)
        .option("checkpointLocation", f"{CHECKPOINT_DIR}/clicks-v1")
        .trigger(processingTime="15 seconds")
        .start()
    )

    print(
        f"[zaggo] streaming iniciado: kafka={KAFKA_BROKERS} topic={KAFKA_TOPIC} "
        f"pg={PG_HOST}:{PG_PORT}/{PG_DB}",
        flush=True,
    )

    try:
        spark.streams.awaitAnyTermination()
    except KeyboardInterrupt:
        for query in spark.streams.active:
            query.stop()
        spark.stop()
        sys.exit(0)


if __name__ == "__main__":
    for attempt in range(1, 6):
        try:
            main()
            break
        except Exception as exc:  # noqa: BLE001
            print(f"[zaggo] falha na tentativa {attempt}: {exc}", flush=True)
            time.sleep(10)
    else:
        sys.exit(1)
