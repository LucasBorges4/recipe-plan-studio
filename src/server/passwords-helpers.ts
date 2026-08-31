import type { Storage } from "./storage";

export async function updateUserPassword(storage: Storage, userId: string, hash: string, salt: string): Promise<void> {
  const anyStorage = storage as unknown as { db?: { prepare: (sql: string) => { run: (...p: unknown[]) => unknown } } };
  if (anyStorage.db) {
    anyStorage.db.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?").run(hash, salt, new Date().toISOString(), userId);
    return;
  }
  const mem = storage as unknown as { users?: Array<{ id: string; passwordHash: string; passwordSalt: string }> };
  if (mem.users) {
    const u = mem.users.find((x) => x.id === userId);
    if (u) {
      u.passwordHash = hash;
      u.passwordSalt = salt;
    }
  }
}
