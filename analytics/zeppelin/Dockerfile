# Zeppelin 0.11.2 nativo em ARM64/AMD64 a partir da distribuição oficial.
# A imagem oficial apache/zeppelin:0.11.2 é amd64-only; esta build roda
# nativamente na VM (aarch64) usando JRE 11 multi-arquitetura.
FROM eclipse-temurin:11-jre-jammy

ARG ZEPPELIN_VERSION=0.11.2
# archive.apache.org é o espelho permanente; downloads.apache.org é mais rápido.
ARG ZEPPELIN_DIST_URL="https://archive.apache.org/dist/zeppelin/zeppelin-0.11.2/zeppelin-0.11.2-bin-all.tgz"
ENV ZEPPELIN_HOME=/opt/zeppelin
ENV PATH=${PATH}:${ZEPPELIN_HOME}/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates procps \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "${ZEPPELIN_DIST_URL}" -o /tmp/zeppelin.tgz \
    && tar -xzf /tmp/zeppelin.tgz -C /opt \
    && mv "/opt/zeppelin-${ZEPPELIN_VERSION}-bin-all" /opt/zeppelin \
    && rm -f /tmp/zeppelin.tgz \
    && mkdir -p /opt/zeppelin/notebook /opt/zeppelin/conf \
    && chmod +x /opt/zeppelin/bin/*.sh

COPY conf/zeppelin-site.xml /opt/zeppelin/conf/zeppelin-site.xml
COPY conf/zeppelin-env.sh /opt/zeppelin/conf/zeppelin-env.sh

EXPOSE 8080
WORKDIR /opt/zeppelin
ENTRYPOINT ["/opt/zeppelin/bin/zeppelin.sh"]
