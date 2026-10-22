#!/usr/bin/env python3
"""Configura o Zeppelin no primeiro boot: login, interpretador JDBC e dashboard.

Executado por um container one-shot (python:3.12-alpine). Idempotente:
remove a nota anterior de mesmo nome antes de importar a versão atual.
"""
from __future__ import annotations

import http.cookiejar
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("ZEPPELIN_URL", "http://zeppelin:8080").rstrip("/")
USER = os.environ.get("ZEPPELIN_USER", "admin")
PASSWORD = os.environ.get("ZEPPELIN_PASSWORD", "")
PG_HOST = os.environ.get("PG_HOST", "portal-postgres")
PG_PORT = os.environ.get("PG_PORT", "5432")
PG_DB = os.environ.get("PG_DB", "portal")
PG_USER = os.environ.get("PG_USER", "portal")
PG_PASSWORD = os.environ.get("PG_PASSWORD", "")
NOTE_NAME = "ZAGGO — Comportamento em Tempo Real"


def log(message: str) -> None:
    print(f"[zeppelin-bootstrap] {message}", flush=True)


def opener() -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def call(
    client: urllib.request.OpenerDirector,
    method: str,
    path: str,
    data: object | None = None,
    form: bool = False,
    timeout: int = 60,
) -> tuple[int, str]:
    headers = {"Accept": "application/json"}
    body: bytes | None = None
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json"
    request = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with client.open(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace")


def wait_for_zeppelin() -> None:
    client = opener()
    for attempt in range(1, 91):
        try:
            status, _ = call(client, "GET", "/api/version", timeout=5)
            if status == 200:
                log("Zeppelin disponível")
                return
        except Exception:  # noqa: BLE001
            pass
        log(f"aguardando Zeppelin… ({attempt}/90)")
        time.sleep(4)
    raise SystemExit("Zeppelin não respondeu a tempo")


def login(client: urllib.request.OpenerDirector) -> None:
    for attempt in range(1, 6):
        status, raw = call(
            client,
            "POST",
            "/api/login",
            {"userName": USER, "password": PASSWORD},
            form=True,
        )
        if status in (200, 302):
            log(f"login OK ({USER})")
            return
        log(f"login falhou ({status}): {raw[:160]} — tentativa {attempt}/5")
        time.sleep(3)
    raise SystemExit("não foi possível autenticar no Zeppelin; verifique shiro.ini")


def configure_jdbc(client: urllib.request.OpenerDirector) -> None:
    status, raw = call(client, "GET", "/api/interpreter/setting")
    if status != 200:
        log(f"não foi possível listar interpretadores ({status})")
        return
    settings = json.loads(raw)
    if isinstance(settings, dict):
        settings = settings.get("body", [])

    jdbc = next((item for item in settings if item.get("name") == "jdbc"), None)
    if jdbc is None:
        log("interpretador jdbc não encontrado; criando…")
        create_status, create_raw = call(
            client,
            "POST",
            "/api/interpreter/setting",
            {"name": "jdbc", "group": "jdbc"},
        )
        log(f"criação jdbc: {create_status} {create_raw[:160]}")
        status, raw = call(client, "GET", "/api/interpreter/setting")
        settings = json.loads(raw)
        if isinstance(settings, dict):
            settings = settings.get("body", [])
        jdbc = next((item for item in settings if item.get("name") == "jdbc"), None)

    if jdbc is None:
        log("interpretador jdbc indisponível; dashboards podem ser importados manualmente")
        return

    interpreter_id = jdbc.get("id")
    payload = dict(jdbc)

    # O REST devolve properties como mapa de metadados
    # ({name, value, type, description}); preservamos o formato e só
    # trocamos os valores — enviar strings simples causa erro 500 de Jackson.
    properties = {}
    existing_props = jdbc.get("properties") or {}
    for key, meta in existing_props.items():
        properties[key] = dict(meta) if isinstance(meta, dict) else {"name": key, "value": "", "type": "string", "description": ""}
    values = {
        "default.url": f"jdbc:postgresql://{PG_HOST}:{PG_PORT}/{PG_DB}",
        "default.user": PG_USER,
        "default.password": PG_PASSWORD,
        "default.driver": "org.postgresql.Driver",
        "default.completer.schemaFilters": "analytics",
        "zeppelin.jdbc.maxConnLifetime": "1800000",
    }
    for key, value in values.items():
        meta = properties.get(key) or {"name": key, "value": "", "type": "string", "description": ""}
        meta["value"] = value
        properties[key] = meta
    payload["properties"] = properties

    artifact = "org.postgresql:postgresql:42.7.3"
    existing_deps = jdbc.get("dependencies") or []
    if existing_deps and isinstance(existing_deps[0], str):
        payload["dependencies"] = [artifact]
        alternate = [{"groupArtifactVersion": artifact, "exclusions": []}]
    else:
        payload["dependencies"] = [{"groupArtifactVersion": artifact, "exclusions": []}]
        alternate = [artifact]

    status, raw = call(client, "PUT", f"/api/interpreter/setting/{interpreter_id}", payload)
    if status not in (200, 201):
        log(f"configuração JDBC rejeitada ({status}): {raw[:220]}")
        log("tentando formato alternativo de dependência…")
        payload["dependencies"] = alternate
        status, raw = call(client, "PUT", f"/api/interpreter/setting/{interpreter_id}", payload)
    log(f"configuração JDBC: {status} {raw[:160]}")

    status, raw = call(client, "PUT", f"/api/interpreter/setting/restart/{interpreter_id}")
    log(f"restart JDBC: {status} {raw[:160]}")


def import_notebook(client: urllib.request.OpenerDirector) -> None:
    with open("/notebook.json", "r", encoding="utf-8") as handle:
        note = json.load(handle)

    status, raw = call(client, "GET", "/api/notebook")
    if status == 200:
        notes = json.loads(raw)
        if isinstance(notes, dict):
            notes = notes.get("body", [])
        target = note.get("name")
        for existing in notes:
            existing_path = (existing.get("path") or "").lstrip("/")
            if existing.get("name") == target or existing_path == target:
                note_id = existing.get("id")
                if note_id:
                    delete_status, _ = call(client, "DELETE", f"/api/notebook/{note_id}")
                    log(f"nota anterior removida ({note_id}): {delete_status}")
                    break

    status, raw = call(client, "POST", "/api/notebook/import", note, timeout=120)
    if status in (200, 201):
        log(f"dashboard importado: {NOTE_NAME}")
    else:
        log(f"falha ao importar dashboard ({status}): {raw[:300]}")
        log("importe manualmente analytics/zeppelin/notebook.json pela UI")


def main() -> int:
    if not PASSWORD:
        log("ZEPPELIN_PASSWORD vazio; abortando")
        return 0
    wait_for_zeppelin()
    client = opener()
    try:
        login(client)
        configure_jdbc(client)
        import_notebook(client)
    except SystemExit as error:
        log(str(error))
        return 0
    except Exception as error:  # noqa: BLE001
        log(f"erro inesperado: {error}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
