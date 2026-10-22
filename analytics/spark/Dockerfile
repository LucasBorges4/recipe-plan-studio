FROM apache/spark:3.5.3-scala2.12-java17-python3-ubuntu

USER root

# curl para baixar os conectores e ca-certificates para TLS do Maven Central.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Conectores Kafka + driver JDBC do Postgres no classpath do Spark.
RUN cd /opt/spark/jars \
    && curl -fsSLO https://repo1.maven.org/maven2/org/apache/spark/spark-sql-kafka-0-10_2.12/3.5.3/spark-sql-kafka-0-10_2.12-3.5.3.jar \
    && curl -fsSLO https://repo1.maven.org/maven2/org/apache/spark/spark-token-provider-kafka-0-10_2.12/3.5.3/spark-token-provider-kafka-0-10_2.12-3.5.3.jar \
    && curl -fsSLO https://repo1.maven.org/maven2/org/apache/kafka/kafka-clients/3.4.1/kafka-clients-3.4.1.jar \
    && curl -fsSLO https://repo1.maven.org/maven2/org/apache/commons/commons-pool2/2.11.0/commons-pool2-2.11.0.jar \
    && curl -fsSLO https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.3/postgresql-42.7.3.jar

RUN pip3 install --no-cache-dir psycopg2-binary==2.9.10

COPY job.py /opt/job/job.py
COPY entrypoint.sh /opt/job/entrypoint.sh
RUN chmod +x /opt/job/entrypoint.sh \
    && mkdir -p /opt/spark/work-dir/checkpoints

WORKDIR /opt/spark/work-dir
