import {
  ANALYTICS_LIMITS,
  deviceFromViewport,
  maskLabel,
  sanitizeProps,
  type AnalyticsEventInput,
  type AnalyticsEventType,
} from "@/lib/analytics";

/**
 * Tracker comportamental leve, sem dependências e sem PII.
 *
 * - Sessão: `sessionStorage` (some ao fechar a aba).
 * - Anônimo: `localStorage` (rotacionável; não identifica a pessoa).
 * - Envia em lotes para `/api/track` (same-origin, `sendBeacon` quando
 *   disponível) e nunca bloqueia a navegação.
 * - Respeita `navigator.doNotTrack` e o opt-out do usuário.
 * - Não captura valores de inputs, texto de senha, e-mails ou números.
 */

const ENDPOINT = "/api/track";
const SESSION_KEY = "zaggo.sid";
const ANON_KEY = "zaggo.aid";
const OPTOUT_KEY = "zaggo.analytics.optout";
const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUE = 25;

let started = false;
let queue: AnalyticsEventInput[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let currentPath = "/";
let pageEnteredAt = Date.now();
let pageActive = false;
let maxScroll = 0;
let lastClick = { at: 0, x: 0, y: 0, count: 0, key: "" };
let pageViewId = 0;

function uid(prefix: string): string {
  try {
    return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function readId(storage: Storage, key: string, prefix: string): string {
  try {
    const existing = storage.getItem(key);
    if (existing && existing.length <= 80) return existing;
    const created = uid(prefix);
    storage.setItem(key, created);
    return created;
  } catch {
    return uid(prefix);
  }
}

function sessionId(): string {
  return readId(sessionStorage, SESSION_KEY, "s");
}

function anonId(): string {
  return readId(localStorage, ANON_KEY, "a");
}

/** O tracker está ativo? (SSR-safe, respeita DNT + opt-out) */
export function isTrackingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = navigator as Navigator & { doNotTrack?: string | null; msDoNotTrack?: string | null };
    const win = window as Window & { doNotTrack?: string | null };
    if (nav.doNotTrack === "1" || nav.msDoNotTrack === "1" || win.doNotTrack === "1") return false;
    if (localStorage.getItem(OPTOUT_KEY) === "1") return false;
  } catch {
    return false;
  }
  return true;
}

/** Liga/desliga a coleta para este navegador (LGPD — direito de oposição). */
export function setTrackingOptOut(optedOut: boolean): void {
  try {
    if (optedOut) {
      localStorage.setItem(OPTOUT_KEY, "1");
      queue = [];
      if (timer) clearInterval(timer);
      timer = null;
    } else {
      localStorage.removeItem(OPTOUT_KEY);
      if (!started) startTracker();
    }
  } catch {
    /* armazenamento indisponível */
  }
}

export function isTrackingOptedOut(): boolean {
  try {
    return localStorage.getItem(OPTOUT_KEY) === "1";
  } catch {
    return true;
  }
}

function enqueue(type: AnalyticsEventType, extra: Partial<AnalyticsEventInput> = {}): void {
  if (!isTrackingEnabled()) return;
  if (queue.length >= MAX_QUEUE) void flush();

  const event: AnalyticsEventInput = {
    id: uid("evt"),
    type,
    ts: new Date().toISOString(),
    path: extra.path ?? currentPath,
    sessionId: sessionId(),
    anonId: anonId(),
    title: cleanTitle(document.title),
    referrer: currentReferrer(),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    device: deviceFromViewport(window.innerWidth),
    ...extra,
  };

  if (!event.ts || !event.sessionId) return;
  queue.push(event);
}

function cleanTitle(value: string): string {
  return maskLabel(value, ANALYTICS_LIMITS.maxTitleLength);
}

let lastReferrer = "";

function currentReferrer(): string {
  return lastReferrer;
}

function setReferrerFromPrevious(path: string): void {
  lastReferrer = path;
}

function scrollPct(): number {
  const doc = document.documentElement;
  const total = Math.max(1, doc.scrollHeight - window.innerHeight);
  const pct = Math.round((window.scrollY / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

async function flush(useBeacon = false): Promise<void> {
  if (queue.length === 0) return;
  const events = queue.splice(0, MAX_QUEUE);
  const body = JSON.stringify({ events });
  try {
    if (useBeacon && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    /* nunca deixar a telemetria quebrar a experiência */
  }
}

/** Evento customizado (ex.: abriu uma tarefa, exportou um relatório). */
export function trackEvent(
  type: AnalyticsEventType,
  props?: Record<string, string | number | boolean>,
  extra?: Partial<AnalyticsEventInput>,
): void {
  if (!isTrackingEnabled()) return;
  enqueue(type, { ...extra, ...(props ? { props: sanitizeProps(props) } : {}) });
}

/** Marca visualização de página; chamado a cada mudança de rota. */
export function trackPageView(path: string): void {
  if (!isTrackingEnabled()) return;
  if (started) {
    // Fecha a página anterior antes de trocar de rota.
    trackPageLeave();
  }
  pageViewId += 1;
  setReferrerFromPrevious(currentPath);
  currentPath = path || "/";
  pageEnteredAt = Date.now();
  pageActive = true;
  maxScroll = 0;
  const view: Partial<AnalyticsEventInput> = { path: currentPath };
  if (lastReferrer) view.referrer = lastReferrer;
  enqueue("page_view", view);
}

/** Fecha a página atual com tempo de permanência e profundidade de scroll. */
export function trackPageLeave(): void {
  if (!isTrackingEnabled() || !pageActive) return;
  pageActive = false;
  const duration = Date.now() - pageEnteredAt;
  if (duration < 300) return; // ignora navegações instantâneas/redirects
  enqueue("page_leave", {
    path: currentPath,
    durationMs: duration,
    scrollPct: maxScroll,
  });
}

function labelFor(el: Element): string {
  const target = el as HTMLElement;
  const explicit = target.getAttribute("data-track");
  if (explicit) return maskLabel(explicit);
  const aria = target.getAttribute("aria-label");
  if (aria) return maskLabel(aria);
  const id = target.getAttribute("id");
  if (id) return maskLabel(`#${id}`);
  const text = target.textContent ?? "";
  return maskLabel(text.replace(/\s+/g, " ").trim()).slice(0, 80) || target.tagName.toLowerCase();
}

function shouldIgnore(el: Element): boolean {
  if (el.closest("[data-no-track]")) return true;
  if (el.closest("input[type='password'], input[type='email'], textarea, [contenteditable='true']"))
    return true;
  if (el.closest("[data-sensitive]")) return true;
  return false;
}

function interactiveElement(start: Element | null): Element | null {
  if (!start) return null;
  return start.closest("a, button, [role='button'], [data-track], summary, label");
}

function installListeners(): void {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      const el = interactiveElement(target);
      if (!el || shouldIgnore(el)) return;

      const label = labelFor(el);
      const now = Date.now();
      const key = label;
      const sameSpot =
        Math.abs(event.clientX - lastClick.x) < 30 && Math.abs(event.clientY - lastClick.y) < 30;
      const isRage = now - lastClick.at < 1000 && sameSpot && lastClick.key === key;
      const count = isRage ? lastClick.count + 1 : 1;

      const clickProps: Record<string, string> = {
        element: label,
        tag: el.tagName.toLowerCase(),
      };
      const href = el.getAttribute("href");
      if (href && href.startsWith("/")) clickProps["href"] = href;
      trackEvent("click", clickProps);

      if (count >= 3) {
        trackEvent("rage_click", { element: label, count });
        lastClick = { at: 0, x: 0, y: 0, count: 0, key: "" };
      } else {
        lastClick = { at: now, x: event.clientX, y: event.clientY, count, key };
      }
    },
    { capture: true, passive: true },
  );

  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener(
    "scroll",
    () => {
      maxScroll = Math.max(maxScroll, scrollPct());
      if (scrollTimer) return;
      scrollTimer = setTimeout(() => {
        scrollTimer = null;
        if (maxScroll >= 25) {
          trackEvent("scroll_depth", { scrollPct: maxScroll, path: currentPath });
        }
      }, 1500);
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      trackPageLeave();
      void flush(true);
    }
  });

  window.addEventListener("pagehide", () => {
    trackPageLeave();
    void flush(true);
  });
}

/** Inicializa o tracker uma única vez (idempotente). */
export function startTracker(): void {
  if (started || !isTrackingEnabled()) return;
  started = true;
  currentPath = window.location.pathname + window.location.search;
  installListeners();
  timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
}
