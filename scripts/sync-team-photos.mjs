#!/usr/bin/env node
/**
 * Sincroniza fotos de pessoas no projeto e padroniza a proporção em 4:3.
 *
 * Faz a varredura em:
 *   - raiz do projeto (top-level *.png, ex.: "Foto Camila.png")
 *   - public/team/*.png
 *
 * Normaliza o nome do arquivo para o slug da pessoa (sem acentos/parenteses),
 * copia para public/team/<slug>.png, recorta a foto em 4:3 e regenera
 * src/lib/team-photos.generated.ts (o manifest usado por /equipe, /perfil e
 * pelo avatar automático do login).
 *
 * Arquivos com "logo"/"zaggo" no nome são ignorados (não são pessoas).
 *
 * Sobre o 4:3: `PHOTO_ASPECT` e `HEADROOM` são exportados e comparados com
 * `src/lib/photo-frame.ts` no teste `photo-frame-sync.test.ts` — o recorte do
 * arquivo e o recorte do upload em /perfil precisam cair no mesmo lugar.
 *
 * Uso: npm run photos:sync
 */
import {
  readdirSync,
  copyFileSync,
  existsSync,
  statSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

/** O corte 4:3 é obrigatório aqui, então a ausência do `sharp` é um erro duro. */
let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error(
    "[photos:sync] falta a dependência `sharp`, necessária para recortar as fotos em 4:3.\n" +
      "              Rode `npm install` para instalá-la.",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEAM_DIR = join(ROOT, "public", "team");
const OUT_FILE = join(ROOT, "src", "lib", "team-photos.generated.ts");

/** Largura:altura canônica das fotos do portal. Espelha `src/lib/photo-frame.ts`. */
export const PHOTO_ASPECT = 4 / 3;

/** Fração da sobra vertical deixada **acima** do corte. Espelha `photo-frame.ts`. */
export const HEADROOM = 0.3;

function normalizeNameSlug(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prettyName(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isPersonSlug(slug) {
  return slug.length > 0 && !slug.includes("logo") && !slug.includes("zaggo");
}

function listFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".png"))
      .map((f) => join(dir, f))
      .filter((p) => statSync(p).isFile());
  } catch {
    return [];
  }
}

/**
 * Recorte 4:3 com a mesma geometria de `cropTo43` em `src/lib/photo-frame.ts`:
 * centraliza na horizontal e preserva headroom na vertical.
 */
export function cropRect(width, height) {
  if (width / height > PHOTO_ASPECT) {
    const w = Math.round(height * PHOTO_ASPECT);
    return { left: Math.round((width - w) / 2), top: 0, width: w, height };
  }
  if (height / width > 1 / PHOTO_ASPECT) {
    const h = Math.round(width / PHOTO_ASPECT);
    return { left: 0, top: Math.round((height - h) * HEADROOM), width, height: h };
  }
  return { left: 0, top: 0, width, height };
}

/** `true` quando a foto já está em 4:3 dentro de 1px (tolerância de arredondamento). */
function isAlready43(width, height) {
  return Math.abs(width / height - PHOTO_ASPECT) < 0.01;
}

/**
 * Garante 4:3 no arquivo. Idempotente: foto já em 4:3 não é reprocessada, então
 * rodar o sync várias vezes não degrada a imagem.
 */
async function normalize43(file) {
  const meta = await sharp(file).metadata();
  const { width = 0, height = 0 } = meta;
  if (width === 0 || height === 0) return { changed: false, reason: "ilegível" };
  if (isAlready43(width, height))
    return { changed: false, reason: `já é 4:3 (${width}x${height})` };

  const rect = cropRect(width, height);
  const buf = await sharp(file).extract(rect).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(file, buf);
  return {
    changed: true,
    reason: `${width}x${height} → ${rect.width}x${rect.height}`,
  };
}

async function main() {
  if (!existsSync(TEAM_DIR)) mkdirSync(TEAM_DIR, { recursive: true });

  const sources = [...listFiles(ROOT), ...listFiles(TEAM_DIR)];
  const entries = [];
  const copied = [];
  const normalized = [];

  for (const src of sources) {
    const filename = src.split("/").pop() || "";
    const slug = normalizeNameSlug(filename.replace(/\.png$/i, ""));
    if (!isPersonSlug(slug)) {
      console.log(`  [ignorado] ${filename} (não parece ser foto de pessoa)`);
      continue;
    }
    const target = join(TEAM_DIR, `${slug}.png`);
    if (resolve(src) !== resolve(target) && !existsSync(target)) {
      copyFileSync(src, target);
      copied.push(filename);
    }

    const file = resolve(src) === resolve(target) ? target : src;
    const result = await normalize43(file);
    if (result.changed) normalized.push(`${slug} (${result.reason})`);

    entries.push({ slug, name: prettyName(slug), photo: `/team/${slug}.png` });
  }

  entries.sort((a, b) => a.slug.localeCompare(b.slug));
  const unique = [];
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.slug)) continue;
    seen.add(e.slug);
    unique.push(e);
  }

  const body = unique
    .map(
      (e) =>
        `  { slug: ${JSON.stringify(e.slug)}, name: ${JSON.stringify(e.name)}, photo: ${JSON.stringify(e.photo)} },`,
    )
    .join("\n");

  const content =
    "// AUTO-GERADO por `npm run photos:sync`. Não editar à mão.\n" +
    "// Foto de cada pessoa colocada na raiz do projeto ou em public/team/.\n" +
    "export const teamPhotosManifest: ReadonlyArray<{ slug: string; name: string; photo: string }> = [\n" +
    body +
    "\n];\n";
  const previous = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, "utf8") : "";

  if (content === previous) {
    console.log(`Manifest inalterado (${unique.length} pessoa(s)).`);
  } else {
    writeFileSync(OUT_FILE, content);
    console.log(`Manifest atualizado: ${unique.length} pessoa(s) → ${OUT_FILE}`);
  }
  if (copied.length) {
    console.log(`Fotos copiadas para public/team/: ${copied.join(", ")}`);
  }
  if (normalized.length) {
    console.log(`Fotos normalizadas para 4:3: ${normalized.join(", ")}`);
  } else {
    console.log("Fotos já estavam em 4:3 (nada a recortar).");
  }
  console.log("  Fotos resolvidas:");
  for (const e of unique) console.log(`    ${e.slug} → ${e.photo}`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[photos:sync] falhou:", err);
    process.exit(1);
  });
}
