#!/usr/bin/env bash
# Aguarda as dependências e submete o job de streaming ao cluster Spark.
set -euo pipefail

wait_for() {
  local host="$1" port="$2" label="${3:-$1:$2}"
  echo "[zaggo] aguardando ${label}…"
  until (echo > "/dev/tcp/${host}/${port}") 2>/dev/null; do
    sleep 2
  done
  echo "[zaggo] ${label} disponível"
}

wait_for kafka 9092 "Kafka"
wait_for portal-postgres 5432 "PostgreSQL"
wait_for spark-master 7077 "Spark master"

exec /opt/spark/bin/spark-submit \
  --master "spark://spark-master:7077" \
  --deploy-mode client \
  --name "zaggo-behavior-stream" \
  --driver-memory 768m \
  --executor-memory 1g \
  --total-executor-cores 2 \
  --conf spark.driver.host=spark-job \
  --conf spark.driver.bindAddress=0.0.0.0 \
  --conf spark.driver.port=7078 \
  --conf spark.blockManager.port=7079 \
  --conf spark.sql.shuffle.partitions=4 \
  --conf spark.streaming.stopGracefullyOnShutdown=true \
  /opt/job/job.py
