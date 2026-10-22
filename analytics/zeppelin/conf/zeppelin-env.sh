#!/usr/bin/env bash
# Variáveis de ambiente do Zeppelin (carregado por bin/zeppelin.sh).
export ZEPPELIN_MEM="-Xmx768m -XX:MaxMetaspaceSize=256m"
export ZEPPELIN_INTP_MEM="-Xmx512m"
export ZEPPELIN_NOTEBOOK_DIR="/opt/zeppelin/notebook"
export ZEPPELIN_JAVA_OPTS="${ZEPPELIN_JAVA_OPTS:-} -Dfile.encoding=UTF-8"
