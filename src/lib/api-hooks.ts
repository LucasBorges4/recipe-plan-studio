import { useQuery } from "@tanstack/react-query";
import { meFn, getPortalStateFn, listAuditFn, listUsersFn, taskHistoryFn } from "@/lib/portal-api";
import type { PublicUser } from "@/lib/rbac";
import type { AuditEntry, PortalStatePayload } from "@/lib/records";

/** Chaves de cache compartilhadas entre loader e componentes. */
export const qk = {
  session: ["session"] as const,
  portal: ["portal"] as const,
  audit: ["audit"] as const,
  users: ["users"] as const,
};

export interface SessionInfo {
  user: PublicUser | null;
  persistent: boolean;
}

export function useSession() {
  return useQuery({
    queryKey: qk.session,
    queryFn: () => meFn(),
    staleTime: 30_000,
  });
}

export function usePortalData() {
  return useQuery({
    queryKey: qk.portal,
    queryFn: () => getPortalStateFn(),
    staleTime: 15_000,
  });
}

export function useAuditList(enabled: boolean) {
  return useQuery({
    queryKey: qk.audit,
    queryFn: () => listAuditFn(),
    enabled,
  });
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: qk.users,
    queryFn: () => listUsersFn(),
    enabled,
  });
}

export function useTaskHistory(taskId: string | null) {
  return useQuery({
    queryKey: ["task-history", taskId],
    queryFn: () => taskHistoryFn({ data: { taskId: taskId! } }),
    enabled: !!taskId,
  });
}

export type { AuditEntry, PortalStatePayload };
