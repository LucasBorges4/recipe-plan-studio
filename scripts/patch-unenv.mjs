import { existsSync, writeFileSync } from "node:fs";
const p = "node_modules/unenv/dist/runtime/node/sqlite.mjs";
if (existsSync(p)) {
  writeFileSync(
    p,
    'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url || "file:///");\nconst { DatabaseSync } = require("node:sqlite");\nexport { DatabaseSync };\nexport const StatementSync = undefined;\nexport const constants = {};\nexport default {\n\tDatabaseSync,\n\tStatementSync,\n\tconstants\n};\n',
  );
  console.log("[patch] unenv sqlite.mjs patched");
} else {
  console.log("[patch] unenv sqlite.mjs not found, skipping");
}
