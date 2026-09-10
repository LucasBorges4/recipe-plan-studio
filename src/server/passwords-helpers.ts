import type { Storage } from "./storage";

export async function updateUserPassword(storage: Storage, userId: string, hash: string, salt: string): Promise<void> {
  await storage.updateUserPasswordHash(userId, hash, salt);
}
