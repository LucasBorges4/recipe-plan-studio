/**
 * Contrato compartilhado do tracker de comportamento (cliente + servidor).
 *
 * Princípios de privacidade (LGPD):
 * - Nenhum dado pessoal (nome, e-mail, CPF, telefone, senha) é coletado.
 * - `user_id` é apenas o identificador pseudônimo da sessão autenticada;
 *   o servidor resolve esse ID pelo cookie, nunca pelo cliente.
 * - O IP é transformado em hash com sal (`ANALYTICS_IP_SALT`) e descartado.
 * - Propriedades com nomes sensíveis são removidas no servidor (defesa em
 *   profundidade: o cliente também não as envia).
 * - O tracker respeita Do Not Track e a opção de opt-out do usuário.
 */

/** Eventos aceitos. Qualquer outro valor é descartado na ingestão. */
export const ANALYTICS_EVENT_TYPES = [
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
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

const EVENT_TYPE_SET = new Set<string>(ANALYTICS_EVENT_TYPES);

export interface AnalyticsEventInput {
  id: string;
  type: AnalyticsEventType;
  ts: string;
  path: string;
  title?: string;
  referrer?: string;
  sessionId: string;
  anonId?: string;
  element?: string;
  props?: Record<string, string | number | boolean>;
  durationMs?: number;
  scrollPct?: number;
  viewport?: string;
  lang?: string;
  tz?: string;
  device?: string;
}

export interface AnalyticsEventRecord extends AnalyticsEventInput {
  userId: string | null;
  role: string | null;
  serverTs: string;
  ipHash: string | null;
  uaFamily: string | null;
}

export interface AnalyticsBatch {
  events: AnalyticsEventInput[];
}

/** Limites de tamanho — protegem o endpoint e o banco. */
export const ANALYTICS_LIMITS = {
  maxBatch: 25,
  maxPropKeys: 20,
  maxStringLength: 200,
  maxPathLength: 300,
  maxTitleLength: 160,
  maxElementLength: 120,
  maxBodyBytes: 64 * 1024,
} as const;

/**
 * Chaves de propriedade que nunca podem ser coletadas. A comparação é
 * case-insensitive e por substring para pegar variações (`userEmail`,
 * `card_number`, `authorizationHeader`…).
 */
const SENSITIVE_PROP_PATTERN =
  /(pass|senha|secret|token|email|e-mail|cpf|cnpj|phone|telefone|whatsapp|authorization|cookie|card|cart[aã]o|iban|pix|address|endere[cç]o|birth|nascimento)/i;

/** Remove caracteres de controle e limita o tamanho. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Mascara o rótulo de um elemento antes de enviar: e-mails, telefones e
 * sequências longas de dígitos nunca saem do navegador.
 */
export function maskLabel(value: unknown, max: number = ANALYTICS_LIMITS.maxElementLength): string {
  return cleanText(value, max)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]")
    .replace(/\b\d{3,}\b/g, "[num]");
}

/** Filtra propriedades sensíveis e normaliza valores escalares. */
export function sanitizeProps(
  props: unknown,
  maxKeys = ANALYTICS_LIMITS.maxPropKeys,
): Record<string, string | number | boolean> {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(props as Record<string, unknown>)) {
    if (Object.keys(out).length >= maxKeys) break;
    const key = cleanText(rawKey, 40);
    if (!key || SENSITIVE_PROP_PATTERN.test(key)) continue;
    if (typeof rawValue === "boolean") {
      out[key] = rawValue;
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      out[key] = rawValue;
    } else if (typeof rawValue === "string") {
      out[key] = maskLabel(rawValue, ANALYTICS_LIMITS.maxStringLength);
    }
  }
  return out;
}

function isEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === "string" && EVENT_TYPE_SET.has(value);
}

/** Aceita apenas http(s) ou caminho interno; nunca `javascript:` / `data:`. */
function safePath(value: unknown, fallback = "/"): string {
  const text = cleanText(value, ANALYTICS_LIMITS.maxPathLength);
  if (!text) return fallback;
  if (text.startsWith("/")) return text;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      return `${url.pathname}${url.search}`.slice(0, ANALYTICS_LIMITS.maxPathLength);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Rejeita datas absurdas (mais de 1 dia no futuro ou 2 anos no passado).
  const diff = Date.now() - d.getTime();
  if (diff < -86_400_000 || diff > 2 * 365 * 86_400_000) return null;
  return d.toISOString();
}

function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

/** Normaliza um evento bruto recebido do navegador. Retorna null se inválido. */
export function normalizeAnalyticsEvent(raw: unknown): AnalyticsEventInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;

  const id = cleanText(e["id"], 80);
  const sessionId = cleanText(e["sessionId"], 80);
  const ts = isoDate(e["ts"]);
  if (!id || !sessionId || !ts || !isEventType(e["type"])) return null;

  const event: AnalyticsEventInput = {
    id,
    type: e["type"],
    ts,
    path: safePath(e["path"]),
    sessionId,
  };

  const title = cleanText(e["title"], ANALYTICS_LIMITS.maxTitleLength);
  if (title) event.title = title;

  const referrer = safePath(e["referrer"], "");
  if (referrer) event.referrer = referrer;

  const anonId = cleanText(e["anonId"], 80);
  if (anonId) event.anonId = anonId;

  const element = maskLabel(e["element"]);
  if (element) event.element = element;

  const props = sanitizeProps(e["props"]);
  if (Object.keys(props).length > 0) event.props = props;

  const durationMs = finiteNumber(e["durationMs"], 0, 86_400_000);
  if (durationMs !== undefined) event.durationMs = Math.round(durationMs);

  const scrollPct = finiteNumber(e["scrollPct"], 0, 100);
  if (scrollPct !== undefined) event.scrollPct = Math.round(scrollPct);

  const viewport = cleanText(e["viewport"], 20);
  if (viewport) event.viewport = viewport;

  const lang = cleanText(e["lang"], 20);
  if (lang) event.lang = lang;

  const tz = cleanText(e["tz"], 60);
  if (tz) event.tz = tz;

  const device = cleanText(e["device"], 20);
  if (device) event.device = device;

  return event;
}

/** Normaliza um lote; descarta silenciosamente eventos inválidos. */
export function normalizeAnalyticsBatch(raw: unknown): AnalyticsEventInput[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const events = (raw as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  const out: AnalyticsEventInput[] = [];
  for (const item of events.slice(0, ANALYTICS_LIMITS.maxBatch)) {
    const event = normalizeAnalyticsEvent(item);
    if (event) out.push(event);
  }
  return out;
}

/** Deriva um rótulo de dispositivo grosseiro (sem fingerprint). */
export function deviceFromViewport(width: number): "mobile" | "tablet" | "desktop" {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}
