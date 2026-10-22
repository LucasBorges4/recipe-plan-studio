#!/usr/bin/env node
/**
 * Gera eventos sintéticos para validar o pipeline
 * Kafka → Spark → PostgreSQL → Zeppelin e o painel /analytics.
 *
 *   npm run analytics:demo
 *   node scripts/analytics-demo.mjs --sessions 8 --events 160 --url http://localhost:3001
 *
 * Não envia PII: apenas caminhos internos, rótulos genéricos e IDs aleatórios.
 */
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const BASE_URL = arg("url", process.env.PORTAL_URL ?? "http://localhost:3001").replace(/\/$/, "");
const SESSIONS = Math.max(1, Number(arg("sessions", "6")));
const TOTAL_EVENTS = Math.max(10, Number(arg("events", "140")));

const PAGES = [
  { path: "/", title: "Painel Executivo" },
  { path: "/tarefas", title: "Tarefas" },
  { path: "/compliance", title: "Compliance" },
  { path: "/riscos", title: "Riscos e Controles" },
  { path: "/documentos", title: "Documentos" },
  { path: "/equipe", title: "Equipe" },
  { path: "/mentoria", title: "Mentoria" },
  { path: "/analytics", title: "Comportamento" },
  { path: "/wiki", title: "Base de Conhecimento" },
  { path: "/automacoes", title: "Automações" },
];

const CLICKS = [
  "Nova tarefa",
  "Filtrar",
  "Ver detalhes",
  "Exportar relatório",
  "Aprovar",
  "Concluir etapa",
  "Abrir documento",
  "Buscar",
  "Próxima página",
];

const DEVICES = ["desktop", "desktop", "desktop", "mobile", "tablet"];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function uid(prefix) {
  return `${prefix}_${randomUUID()}`;
}

function iso(msAgo) {
  return new Date(Date.now() - msAgo).toISOString();
}

function buildSession(index) {
  const sessionId = uid(`s_demo${index}`);
  const anonId = uid("a_demo");
  const device = pick(DEVICES);
  const viewport = device === "mobile" ? "390x844" : device === "tablet" ? "820x1180" : "1440x900";
  const events = [];
  const pages = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => pick(PAGES));
  let cursor = 0;

  for (const page of pages) {
    const started = Date.now() - 1000 * 60 * Math.random() * 8;
    events.push({
      id: uid("evt"),
      type: "page_view",
      ts: new Date(started).toISOString(),
      path: page.path,
      title: page.title,
      referrer: cursor > 0 ? pages[cursor - 1].path : "/",
      sessionId,
      anonId,
      viewport,
      lang: "pt-BR",
      tz: "America/Sao_Paulo",
      device,
    });

    const scroll = 25 + Math.floor(Math.random() * 70);
    events.push({
      id: uid("evt"),
      type: "scroll_depth",
      ts: iso(1000 * 60 * Math.random() * 6),
      path: page.path,
      title: page.title,
      sessionId,
      anonId,
      scrollPct: scroll,
      viewport,
      lang: "pt-BR",
      tz: "America/Sao_Paulo",
      device,
    });

    const clicks = 1 + Math.floor(Math.random() * 3);
    for (let c = 0; c < clicks; c += 1) {
      events.push({
        id: uid("evt"),
        type: "click",
        ts: iso(1000 * 30 * Math.random()),
        path: page.path,
        title: page.title,
        sessionId,
        anonId,
        element: pick(CLICKS),
        props: { tag: "button" },
        viewport,
        lang: "pt-BR",
        tz: "America/Sao_Paulo",
        device,
      });
    }

    if (Math.random() < 0.18) {
      events.push({
        id: uid("evt"),
        type: "rage_click",
        ts: iso(1000 * 20 * Math.random()),
        path: page.path,
        title: page.title,
        sessionId,
        anonId,
        element: "Filtrar",
        props: { count: 3 },
        viewport,
        lang: "pt-BR",
        tz: "America/Sao_Paulo",
        device,
      });
    }

    const duration = 8000 + Math.floor(Math.random() * 90_000);
    events.push({
      id: uid("evt"),
      type: "page_leave",
      ts: new Date(started + duration).toISOString(),
      path: page.path,
      title: page.title,
      sessionId,
      anonId,
      durationMs: duration,
      scrollPct: scroll,
      viewport,
      lang: "pt-BR",
      tz: "America/Sao_Paulo",
      device,
    });

    cursor += 1;
  }

  if (Math.random() < 0.7) {
    events.push({
      id: uid("evt"),
      type: "task_open",
      ts: iso(1000 * 60 * Math.random() * 4),
      path: "/tarefas",
      sessionId,
      anonId,
      props: { board: "governanca" },
      device,
    });
  }
  if (Math.random() < 0.35) {
    events.push({
      id: uid("evt"),
      type: Math.random() < 0.5 ? "task_create" : "task_move",
      ts: iso(1000 * 60 * Math.random() * 4),
      path: "/tarefas",
      sessionId,
      anonId,
      props: { status: "Em andamento" },
      device,
    });
  }
  if (Math.random() < 0.3) {
    events.push({
      id: uid("evt"),
      type: "search",
      ts: iso(1000 * 60 * Math.random() * 4),
      path: "/",
      sessionId,
      anonId,
      props: { results: Math.floor(Math.random() * 12) },
      device,
    });
  }

  return events;
}

async function main() {
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`Portal indisponível em ${BASE_URL}. Rode "npm run dev" ou verifique o PM2.`);
    process.exitCode = 1;
    return;
  }

  const all = [];
  for (let i = 0; i < SESSIONS; i += 1) all.push(...buildSession(i));
  all.sort((a, b) => a.ts.localeCompare(b.ts));
  const events = all.slice(0, TOTAL_EVENTS);

  let sent = 0;
  for (let i = 0; i < events.length; i += 10) {
    const batch = events.slice(i, i + 10);
    const response = await fetch(`${BASE_URL}/api/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
    if (!response.ok) {
      console.error(`Falha no lote ${i / 10 + 1}: HTTP ${response.status}`);
    } else {
      sent += batch.length;
    }
    process.stdout.write(`\r[analytics:demo] enviados ${sent}/${events.length}`);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  console.log(`\n[analytics:demo] ${sent} eventos em ${SESSIONS} sessões.`);
  console.log("[analytics:demo] aguarde 10–20 s e abra /analytics ou o notebook do Zeppelin.");
}

await main();
