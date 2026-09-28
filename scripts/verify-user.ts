import { getStorage } from "@/server/storage";
const s = await getStorage();
const u = await s.getUserByEmail("pedro.castro@gwg.com");
console.log(u ? "✅ "+u.name+"  <"+u.email+"> role="+u.role+" id="+u.id : "nao encontrado");
await s.dispose?.();
