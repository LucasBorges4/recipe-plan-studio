import type { Storage } from "@/server/storage";
import { buildLinkedTeamMembers, type TeamMemberLinked } from "@/lib/team-photos";

/**
 * Catálogo de /equipe enriquecido com o vínculo das contas reais
 * (usuário atrelado + e-mail + flag registered).
 */
export async function listTeamMembers(storage: Storage): Promise<TeamMemberLinked[]> {
  const users = await storage.listUsers();
  const links = new Map<string, { userId: string; email: string }>();
  for (const u of users) {
    if (u.teamMemberId) links.set(u.teamMemberId, { userId: u.id, email: u.email });
  }
  return buildLinkedTeamMembers(links);
}