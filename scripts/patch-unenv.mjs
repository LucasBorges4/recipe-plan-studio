import { existsSync, writeFileSync } from "node:fs";
const p = "node_modules/unenv/dist/runtime/node/sqlite.mjs";
if (existsSync(p)) {
  const code = `let DatabaseSyncImpl;
try {
  const { createRequire } = await import("node:module");
  const require = createRequire(typeof process !== "undefined" && process.cwd ? process.cwd() + "/index.js" : (import.meta.url || "file:///"));
  DatabaseSyncImpl = require("node:sqlite")?.DatabaseSync;
} catch {
  DatabaseSyncImpl = undefined;
}
export const DatabaseSync = DatabaseSyncImpl;
export const StatementSync = undefined;
export const constants = {};
export default {
  DatabaseSync: DatabaseSyncImpl,
  StatementSync,
  constants
};
`;
  writeFileSync(p, code);
  console.log("[patch] unenv sqlite.mjs safely patched");
} else {
  console.log("[patch] unenv sqlite.mjs not found, skipping");
}

