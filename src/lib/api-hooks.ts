import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  listPublicUsersFn,
  meFn,
  getPortalStateFn,
  listAuditFn,
  listUsersFn,
  taskHistoryFn,
  listRoleFunctionsFn,
  listN8nWorkflowsFn,
  getN8nWorkflowFn,
  listUserSessionsFn,
  revokeAllSessionsFn,
  globalSearchFn,
  listInvitesFn,
} from "@/lib/portal-api";
import type { PublicUser } from "@/lib/rbac";
import type { AuditEntry, PortalStatePayload } from "@/lib/records";
import type { N8nWorkflow } from "@/server/n8n";

/** Chaves de cache compartilhadas entre loader e componentes. */
export const qk = {
  session: ["session"] as const,
  portal: ["portal"] as const,
  audit: ["audit"] as const,
  users: ["users"] as const,
  roleFunctions: ["roleFunctions"] as const,
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

export function usePublicUsers() {
  return useQuery({
    queryKey: ["public-users"] as const,
    queryFn: () => listPublicUsersFn(),
    staleTime: 60_000,
  });
}

export function useTaskHistory(taskId: string | null) {
  return useQuery({
    queryKey: ["task-history", taskId],
    queryFn: () => taskHistoryFn({ data: { taskId: taskId! } }),
    enabled: !!taskId,
  });
}

export function useRoleFunctions() {
  return useQuery({
    queryKey: qk.roleFunctions,
    queryFn: () => listRoleFunctionsFn(),
    staleTime: 60_000,
  });
}

export function useN8nWorkflows() {
  return useQuery({
    queryKey: ["n8n-workflows"] as const,
    queryFn: () => listN8nWorkflowsFn(),
    staleTime: 30_000,
  });
}

export function useN8nWorkflow(id: number | undefined) {
  return useQuery({
    queryKey: ["n8n-workflow", id] as const,
    queryFn: () => getN8nWorkflowFn({ data: { id: id! } }),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useUserSessions() {
  return useQuery({
    queryKey: ["user-sessions"] as const,
    queryFn: () => listUserSessionsFn(),
    staleTime: 30_000,
  });
}

export function useRevokeSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => revokeAllSessionsFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.session });
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
    },
  });
}

export type { AuditEntry, PortalStatePayload, N8nWorkflow };

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: ["global-search", q] as const,
    queryFn: () => globalSearchFn({ data: { q } }),
    enabled: q.length >= 2,
    staleTime: 15_000,
  });
}

export function useInvites() {
  return useQuery({
    queryKey: ["invites"] as const,
    queryFn: () => listInvitesFn(),
    staleTime: 30_000,
  });
}
