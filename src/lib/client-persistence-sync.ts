import type { PublicUser } from "@/lib/rbac";
import type { PortalStatePayload, DocRecord, NextStepRecord, LegalDocRecord } from "@/lib/records";

const PORTAL_CACHE_KEY = "geos_portal_local_cache_v2";
const LOCAL_USER_KEY = "geos_local_user_v2";

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedJson: string | null = null;

export function savePortalStateToLocal(state: PortalStatePayload): void {
  if (!isBrowser()) return;
  try {
    const json = JSON.stringify(state);
    if (json === lastSavedJson) return; // evita escrita idêntica
    lastSavedJson = json;
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      try {
        localStorage.setItem(PORTAL_CACHE_KEY, json);
      } catch (e) {
        console.warn("[persistence] Erro ao salvar estado local:", e);
      }
    }, 300);
  } catch (e) {
    console.warn("[persistence] Erro ao salvar estado local:", e);
  }
}

export function savePortalStateToLocalImmediate(state: PortalStatePayload): void {
  if (!isBrowser()) return;
  try {
    const json = JSON.stringify(state);
    lastSavedJson = json;
    localStorage.setItem(PORTAL_CACHE_KEY, json);
  } catch (e) {
    console.warn("[persistence] Erro ao salvar estado local:", e);
  }
}

export function getPortalStateFromLocal(): PortalStatePayload | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(PORTAL_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PortalStatePayload;
  } catch {
    return null;
  }
}

let lastServerJson: string | null = null;
let lastMergedResult: PortalStatePayload | null = null;

export function mergePortalStateWithLocal(serverState: PortalStatePayload): PortalStatePayload {
  if (!isBrowser()) return serverState;

  // Memo: se payload idêntico, retorna memoizado sem merge/serialização
  try {
    const curJson = JSON.stringify(serverState);
    if (curJson === lastServerJson && lastMergedResult) return lastMergedResult;
    lastServerJson = curJson;
  } catch {}

  // Se o servidor for persistente (Postgres/Neon, SQLite, D1), salva debounce e retorna
  if (serverState.persistent) {
    savePortalStateToLocal(serverState);
    lastMergedResult = serverState;
    return serverState;
  }

  // Se o servidor for volátil (em memória na nuvem do Lovable):
  const local = getPortalStateFromLocal();
  if (!local) {
    savePortalStateToLocal(serverState);
    return serverState;
  }

  // Mesclar listas com shallow check para evitar rebuild desnecessário
  const mergeById = <T extends { id: string }>(serverItems: T[], localItems: T[] = []): T[] => {
    if (!localItems.length) return serverItems;
    if (serverItems.length === 0) return localItems;
    // shallow: se ids idênticos e mesma ordem, retorna serverItems
    if (serverItems.length === localItems.length) {
      let same = true;
      for (let i = 0; i < serverItems.length; i++) if (serverItems[i].id !== localItems[i].id) { same = false; break; }
      if (same) return serverItems;
    }
    const map = new Map<string, T>();
    for (const item of serverItems) map.set(item.id, item);
    for (const item of localItems) map.set(item.id, item);
    return Array.from(map.values());
  };

  const mergeByKey = <T>(
    serverItems: T[],
    localItems: T[] = [],
    keyExtractor: (item: T) => string,
  ): T[] => {
    if (!localItems.length) return serverItems;
    if (serverItems.length === 0) return localItems;
    const map = new Map<string, T>();
    for (const item of serverItems) map.set(keyExtractor(item), item);
    for (const item of localItems) map.set(keyExtractor(item), item);
    return Array.from(map.values());
  };

  const merged: PortalStatePayload = {
    ...serverState,
    persistent: true,
    storageInitError: null,
    tasks: mergeById(serverState.tasks, local.tasks),
    columns: Array.from(new Set([...(local.columns?.length ? local.columns : serverState.columns)])),
    controls: mergeById(serverState.controls, local.controls),
    comments: mergeById(serverState.comments, local.comments),
    evidences: mergeById(serverState.evidences, local.evidences),
    modules: mergeById(serverState.modules, local.modules),
    risks: mergeById(serverState.risks, local.risks),
    wiki: mergeByKey(serverState.wiki, local.wiki, (w) => w.slug),
    milestones: mergeById(serverState.milestones, local.milestones),
    releases: mergeByKey(serverState.releases, local.releases, (r) => r.version),
    patentStages: mergeById(serverState.patentStages, local.patentStages),
    techStack: mergeByKey(serverState.techStack, local.techStack, (t) => t.name),
    nextSteps: mergeById<NextStepRecord>(serverState.nextSteps, local.nextSteps),
    legalDocs: mergeById<LegalDocRecord>(serverState.legalDocs, local.legalDocs),
    docs: mergeById<DocRecord>(serverState.docs, local.docs),
  };

  savePortalStateToLocal(merged);
  lastMergedResult = merged;
  return merged;
}

export function saveLocalUser(user: PublicUser | null): void {
  if (!isBrowser()) return;
  try {
    if (user) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
  } catch (e) {
    console.warn("[persistence] Erro ao salvar usuário local:", e);
  }
}

export function getLocalUser(): PublicUser | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicUser;
  } catch {
    return null;
  }
}

export function clearLocalUserData(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(PORTAL_CACHE_KEY);
    localStorage.removeItem(LOCAL_USER_KEY);
  } catch (e) {
    console.warn("[persistence] Erro ao limpar dados locais:", e);
  }
}
