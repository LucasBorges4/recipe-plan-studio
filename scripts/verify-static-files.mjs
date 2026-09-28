import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const requiredFiles = [
  "public/zaggo-mark.png",
  "public/favicon.ico",
  "public/assets/styles-BrbkFe_I.css",
];

let allOk = true;

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`❌ Missing: ${file}`);
    allOk = false;
  } else {
    console.log(`✅ ${file}`);
  }
}

// Verify server has the static handler
const serverPath = join(__dirname, "..", ".output", "server", "index.mjs");
if (existsSync(serverPath)) {
  const serverCode = readFileSync(serverPath, "utf-8");
  if (serverCode.includes("staticFileHandler")) {
    console.log("✅ Static handler in server");
  } else {
    console.error("❌ Static handler missing from server!");
    allOk = false;
  }
} else {
  console.error("❌ Server file missing:", serverPath);
  allOk = false;
}

// Verify Nitro server can start
try {
  execSync("node --check .output/server/index.mjs", { timeout: 5000 });
  console.log("✅ Server syntax valid");
} catch (e) {
  console.error("❌ Server has syntax errors");
  allOk = false;
}

if (!allOk) {
  console.error("\n❌ postbuild verification failed!");
  process.exit(1);
}

console.log("\n✅ All postbuild checks passed");
