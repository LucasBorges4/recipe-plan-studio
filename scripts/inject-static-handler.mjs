import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", ".output", "server", "index.mjs");

let code = readFileSync(serverPath, "utf-8");

// Skip if already injected
if (code.includes("custom-static-files")) {
  console.log("✅ Static file handler already injected");
  process.exit(0);
}

// Static file handler code using already-imported modules
const staticHandlerCode = `//#region custom-static-files
var staticFileHandler = defineHandler(async (event) => {
	if (event.req.method !== "GET" && event.req.method !== "HEAD") return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	if (!id || id.startsWith("/_") || id.startsWith("/api") || id.startsWith("/assets")) return;
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	const publicDir = resolve(serverDir, "../../public");
	const filePath = resolve(publicDir, id);
	try {
		if (!existsSync(filePath) || !statSync(filePath).isFile()) return;
		const ext = id.split(".").pop();
		const mimeTypes = { png: "image/png", ico: "image/x-icon", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", css: "text/css", js: "application/javascript", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", json: "application/json", xml: "application/xml", txt: "text/plain", html: "text/html" };
		const contentType = mimeTypes[ext] || "application/octet-stream";
		const buffer = await promises.readFile(filePath);
		event.res.headers.set("Content-Type", contentType);
		event.res.headers.set("Content-Length", buffer.length.toString());
		return new Response(buffer, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
	} catch { return; }
});
//#endregion
`;

// Replace globalMiddleware to include staticFileHandler first
if (!code.includes("staticFileHandler, toEventHandler")) {
  code = code.replace(
    "var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);",
    `var globalMiddleware = [staticFileHandler, toEventHandler(static_default)].filter(Boolean);`
  );
}

// Inject join into node:path imports if not present
if (!code.includes("import { dirname, join, resolve")) {
  code = code.replace(
    "import { dirname, resolve } from \"node:path\";",
    "import { dirname, join, resolve } from \"node:path\";"
  );
}

// Inject existsSync and statSync into node:fs imports if not present
if (!code.includes("existsSync")) {
  code = code.replace(
    "import { promises } from \"node:fs\";",
    "import { promises, existsSync, statSync } from \"node:fs\";"
  );
}

// Insert the static handler code before the static.mjs region
const marker = "//#region node_modules/nitro/dist/runtime/internal/static.mjs";
const idx = code.indexOf(marker);
if (idx !== -1) {
  code = code.slice(0, idx) + staticHandlerCode + "\n" + code.slice(idx);
}

writeFileSync(serverPath, code);
console.log("✅ Static file handler injected into Nitro server");
