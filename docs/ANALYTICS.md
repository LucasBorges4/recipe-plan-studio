# Analytics de comportamento — Kafka → Spark → Zeppelin

Pipeline de telemetria **em tempo real** do portal ZAGGO para entender como os
usuários navegam, onde encontram atrito e quais funções geram valor. A coleta é
**pseudonimizada** (sem PII) e o tracker nunca bloqueia a navegação.

```
Navegador
  │  batched sendBeacon/fetch (a cada 5 s ou 25 eventos)
  ▼
Portal (TanStack Start / Nitro)  ──POST /api/track──►  validação + anonimização
  │                                                        │
  │  fallback local (.data/analytics-fallback.ndjson) ◄────┤ Kafka indisponível
  ▼                                                        ▼
Painel /analytics ◄──Postgres◄── Spark Structured Streaming ◄── Kafka (portal.events)
        (polling 10 s)              │
                                    └──► Apache Zeppelin (dashboards SQL)
```

## Componentes

| Componente | Papel | Porta (host) |
|---|---|---|
| **Portal** | Coleta same-origin, anonimiza, publica no Kafka | `3001` |
| **Kafka 3.9 (KRaft)** | Buffer durável de eventos (7 dias, 3 partições) | `127.0.0.1:9094` |
| **Spark 3.5** | Structured Streaming: deduplicação, agregação, upsert | UI `127.0.0.1:8081/8082` |
| **PostgreSQL 16** | `analytics.events`, agregados e views | `5433` (já existente) |
| **Zeppelin 0.11** | Exploração SQL e dashboards | `127.0.0.1:8090` |

Todas as portas de infraestrutura ficam vinculadas a `127.0.0.1`. O acesso é por
**túnel SSH** — nada de Kafka/Spark/Zeppelin exposto na internet.

> A VM é `aarch64`. A imagem oficial `apache/zeppelin:0.11.2` é amd64-only, por
> isso o compose constrói uma imagem nativa a partir da distribuição oficial
> (JRE 11 arm64 + bin-all do Zeppelin).

## Subir a stack

Pré-requisitos: Docker + Compose v2, `portal-postgres` em execução
(`docker-compose.db.yml`).

```bash
npm run analytics:setup   # gera .env.analytics, shiro.ini e chaves no .env
npm run analytics:up      # build + up (Kafka, Spark, Zeppelin, schema)
npm run deploy            # rebuild do portal com o endpoint /api/track
npm run analytics:demo    # opcional: eventos sintéticos para validar
```

Verificação:

```bash
npm run analytics:status
npm run analytics:logs
curl -s http://localhost:3001/api/health
```

### Acesso ao Zeppelin e ao Spark UI

```bash
ssh -L 8090:127.0.0.1:8090 -L 8081:127.0.0.1:8081 -L 8082:127.0.0.1:8082 usuario@163.176.45.217
```

- Zeppelin: `http://localhost:8090` — usuário `admin`, senha em
  `.env.analytics` (`ZEPPELIN_ADMIN_PASSWORD`).
- Dashboard pronto: **ZAGGO — Comportamento em Tempo Real** (importado no boot).
- Spark Master UI: `http://localhost:8081`.

## O que é coletado

Eventos (allowlist em `src/lib/analytics.ts`):

| Evento | Quando | Campos úteis |
|---|---|---|
| `page_view` / `page_leave` | navegação e saída | `path`, `referrer`, `duration_ms`, `scroll_pct` |
| `click` / `rage_click` | clique em elemento interativo | `element`, `path` |
| `scroll_depth` | rolagem ≥ 25 % | `scroll_pct` |
| `search` / `filter_change` | busca e filtros | `props.results`, `props.filter` |
| `form_submit` | envio de formulário (sem valores) | `props.form` |
| `task_open` / `task_create` / `task_move` | funil de tarefas | `props.board`, `props.status` |
| `login` / `logout` | sessão | — |
| `error` | erro de UI capturado | `props.code` |
| `export` / `download` | geração de artefatos | `props.kind` |
| `custom` | extensão controlada | `props` permitidas |

Contexto técnico: `session_id` (sessionStorage), `anon_id` (localStorage),
`viewport`, `lang`, `tz`, `device`, `ua_family`, `ip_hash`, `server_ts`,
`user_id`/`role` **resolvidos no servidor** pelo cookie de sessão.

### O que NÃO é coletado

- Nome, e-mail, telefone, CPF/CNPJ, endereço, dados de cartão/PIX.
- Valores digitados em inputs, senhas, textos de `textarea`/`contenteditable`.
- IP puro (apenas SHA-256 com sal `ANALYTICS_IP_SALT`).
- Cookies, tokens, headers de autorização.
- Conteúdo de páginas ou rótulos que contenham e-mail/números (mascarados no
  cliente e novamente no servidor).

O tracker respeita `navigator.doNotTrack` e a chave
`localStorage["zaggo.analytics.optout"] = "1"`. As funções
`setTrackingOptOut(true/false)` estão em `src/lib/tracker.ts` para um controle
de privacidade na UI.

## Modelo de dados

Schema `analytics` no banco `portal` (`analytics/postgres/init.sql`):

- `analytics.events` — eventos brutos, PK `event_id` (idempotente), retenção 30 dias.
- `analytics.metrics_1m` — agregados por minuto/página/evento/papel/dispositivo,
  retenção 400 dias.
- `analytics.clicks_1m` — cliques e rage clicks por elemento/página, 400 dias.
- Views para BI: `v_live_kpis`, `v_events_per_minute`, `v_top_pages_15m`,
  `v_click_heatmap_15m`, `v_funnel_24h`, `v_device_breakdown_15m`,
  `v_role_activity_15m`, `v_user_activity_15m`, `v_slow_pages_15m`.

O Spark grava cada microbatch em tabelas `*_stage` via JDBC e faz
`INSERT … ON CONFLICT` no driver (idempotente a reprocessamentos). Checkpoints
ficam no volume `spark_checkpoints`; apagar o volume reinicia o consumo em
`latest`.

## Painel no portal

`/analytics` (papéis `admin`, `diretor`, `gestor`, `auditor`) mostra KPIs,
série por minuto, top páginas, elementos mais clicados, funil de 24 h, sessões
por minuto, **sessões por papel** e **usuários autenticados** (ID pseudônimo,
papel, sessões, eventos e último evento). Atualiza a cada 10 s via
`GET /api/analytics/summary?minutes=60` (protegido por sessão + papel, cache de
8 s).

O `user_id` e o `role` são resolvidos **no servidor** a partir do cookie de
sessão no momento do evento; por isso usuários logados aparecem sincronizados
com o portal. Eventos sem login entram como `Anônimo` e não contam em
“Usuários”. Nenhum nome ou e-mail é exposto no painel analítico.

## Segurança e LGPD

- **Menor privilégio**: endpoint de métricas restrito a papéis de gestão;
  `/analytics` oculto para `visualizador`; `cliente` não acessa.
- **Same-origin**: `/api/track` aceita apenas a própria origem, limita corpo a
  64 KB e 600 eventos/min por IP.
- **Sem PII por design**: allowlist de eventos + blocklist de propriedades
  sensíveis no cliente e no servidor.
- **Retenção**: job diário apaga eventos brutos > 30 dias e agregados > 400 dias.
- **Superfície mínima**: Kafka, Spark UI e Zeppelin em `127.0.0.1`; Zeppelin com
  autenticação obrigatória (Shiro/SHA-256) e nota pertencente a `admin`.
- **Resiliência**: se o Kafka cair, o portal grava NDJSON local
  (`.data/analytics-fallback.ndjson`, rotação em 64 MB) e continua respondendo
  204. O arquivo não é reenviado automaticamente — use-o para reprocessar com
  `kafka-console-producer` se necessário.

> A base legal e o aviso de privacidade devem constar na página `/lgpd`. O
> conjunto de dados é de **navegação pseudonimizada**, não de identificação.

## Operação

```bash
npm run analytics:status   # saúde dos containers
npm run analytics:logs     # logs agregados
npm run analytics:down     # para a stack (preserva volumes)
docker compose --env-file .env.analytics -f docker-compose.analytics.yml down -v  # apaga dados
```

Recursos previstos: Kafka ~1 GB, Spark master/worker ~3,8 GB, job ~1 GB,
Zeppelin ~1,5 GB (limites do compose). A stack cabe nos 16 GB livres da VM.

### Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `/analytics` mostra “schema ausente” | init não rodou | `docker compose … up analytics-db-init` |
| Eventos não chegam ao Postgres | Spark job reiniciando | `docker logs zaggo-spark-job --tail=200` |
| Kafka unhealthy | storage/CLUSTER_ID | `docker logs zaggo-kafka --tail=200` |
| Zeppelin não abre | build ARM ainda em andamento | `docker compose … logs -f zeppelin` |
| Zeppelin login falha | shiro.ini desatualizado | `npm run analytics:setup` e recriar o container |
| IP sempre nulo | proxy sem `X-Forwarded-For` | configure o proxy para repassar o header |

### Escala

Para volume maior: aumente partições de `portal.events`, suba mais workers
Spark (`--cores`/`--memory`) e troque `approx_count_distinct` por contagem
exata em batch. O portal não precisa de mudança — o endpoint só publica.

## Desligar a coleta

```bash
# no .env do portal
ANALYTICS_ENABLED=0
# e reinicie
pm2 restart recipe-plan-studio
```

A stack pode continuar de pé (sem novos eventos) ou ser parada com
`npm run analytics:down`.
