#!/usr/bin/env node
/**
 * Gera os assets de marca (favicon + logo compacto) a partir da arte-mestra.
 *
 * Arte-mestra: public/zaggo-logo.png (quadrado com a palavra "ZAGGO" e o
 * rodapé institucional, ambos centralizados). Esse arquivo não serve para
 * favicon: é 1254x1254 com a marca ocupando só ~6% da altura, então em 32px
 * o nome fica ilegível. Aqui extraímos duas peças:
 *
 *   - `zaggo-wordmark.png` — a palavra "ZAGGO" isolada (recortada, sem o rodapé)
 *   - `zaggo-mark.png`     — o monograma "Z" isolado (peça quadrada, vira ícone)
 *
 * E a partir do monograma: `favicon.ico` (16/32/48/64), `favicon-32x32.png` e
 * `apple-touch-icon.png` (180).
 *
 * A arte-mestra não tem canal alfa — o "Z" vem sobre papel branco. Todos os
 * derivados são achatados em branco, que é o fundo real da marca e o que o
 * iOS exige (ele não renderiza alfa).
 *
 * Uso: npm run brand:assets
 */
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const { default: sharp } = await importSharp();

async function importSharp() {
  try {
    return await import("sharp");
  } catch {
    console.error(
      "[brand:assets] falta a dependência `sharp` (usada só por este script).\n" +
        "               Rode `npm install` para instalá-la.",
    );
    process.exit(1);
  }
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const MASTER = join(PUBLIC, "zaggo-logo.png");

/**
 * A arte-mestra é 1254x1254 e a palavra ocupa 771x134 — ou seja, a peça útil
 * já sai em resolução nativa. As saídas só precisam de folga para retina:
 * a palavra vai 1x (já é grande) e o monograma 2x (é pequeno e precisa
 * segurar o `apple-touch-icon` de 180px sem serrilhado).
 */
const WORDMARK_SCALE = 1;
const MARK_SCALE = 2;

/** Acima deste valor de cinza o pixel é considerado "papel" (fundo da arte). */
const PAPER_THRESHOLD = 240;

/** Colunas em branco entre glifos menores que isso são desconsideradas. */
const MIN_GLYPH_GAP = 4;

function fail(message) {
  console.error(`[brand:assets] ${message}`);
  process.exit(1);
}

/**
 * Lê a arte-mestra em tons de cinza e devolve a máscara de "tinta" mais as
 * faixas horizontais de conteúdo. Espera-se duas faixas: a palavra (mais alta
 * e mais larga) e o rodapé institucional.
 */
async function readInk(file) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const ink = new Uint32Array(width * height);
  for (let i = 0; i < width * height; i++) ink[i] = data[i] <= PAPER_THRESHOLD ? 1 : 0;

  const bands = [];
  let start = null;
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) row += ink[y * width + x];
    const on = row > 0;
    if (on && start === null) start = y;
    if (!on && start !== null) {
      bands.push([start, y - 1]);
      start = null;
    }
  }
  if (start !== null) bands.push([start, height - 1]);

  return {
    width,
    ink,
    bands: bands
      .map(([y0, y1]) => ({ y0, y1, ...boundsOf(ink, width, y0, y1) }))
      .filter((b) => b.width > 0 && b.height > 0)
      .sort((a, b) => a.y0 - b.y0),
  };
}

/** Caixa envolvente (left, top, width, height) do conteúdo em uma faixa. */
function boundsOf(ink, width, y0, y1) {
  let x0 = width;
  let x1 = -1;
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      if (!ink[y * width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  }
  return { x0, y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Separa a palavra em glifos pelas colunas em branco entre eles. */
function splitGlyphs(ink, width, band) {
  const columns = new Uint32Array(width);
  for (let x = 0; x < width; x++) {
    for (let y = band.y0; y <= band.y1; y++) columns[x] += ink[y * width + x];
  }
  const gaps = [];
  let start = null;
  for (let x = 0; x < width; x++) {
    const on = columns[x] > 0;
    if (!on && start === null) start = x;
    if (on && start !== null) {
      if (x - start >= MIN_GLYPH_GAP) gaps.push([start, x - 1]);
      start = null;
    }
  }
  if (start !== null) gaps.push([start, width - 1]);

  const edges = [band.x0, ...gaps.map((g) => g[1] + 1), band.x0 + band.width];
  const glyphs = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = edges[i];
    const x1 = edges[i + 1] - 1;
    if (x1 > x0) glyphs.push({ x0, y0: band.y0, width: x1 - x0 + 1, height: band.height });
  }
  return glyphs;
}

/**
 * Recorta a peça e a rasteriza no tamanho pedido.
 *
 * `fit: "inside"` entrega a caixa mais próxima da proporção original (sem
 * preenchimento); `fit: "contain"` preenche a caixa exatamente, completando
 * com `background`. `background` também é aplicado no `flatten` para que o
 * alfa do PNG de origem não sobreviva na saída.
 */
async function renderPiece(file, region, box, { fit, background, output }) {
  const extract = { left: region.x0, top: region.y0, width: region.width, height: region.height };
  const pad = background ? { r: 255, g: 255, b: 255, alpha: 1 } : undefined;
  let pipeline = sharp(file).extract(extract);
  if (box) {
    pipeline = pipeline.resize({
      width: box.width,
      height: box.height,
      fit,
      background: pad,
      withoutEnlargement: false,
    });
  }
  if (background) pipeline = pipeline.flatten({ background });
  const data = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(output, data);
  return data.length;
}

/** Monta um .ico com imagens PNG embutidas (formato aceito por todos os navegadores atuais). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo 1 = ícone
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach(({ size, data }, i) => {
    const entry = 16 * i;
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 0);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2); // paleta: truecolor
    directory.writeUInt8(0, entry + 3); // reservado
    directory.writeUInt16LE(1, entry + 4); // planos
    directory.writeUInt16LE(32, entry + 6); // bits por pixel
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });

  return Buffer.concat([header, directory, ...images.map((i) => i.data)]);
}

async function main() {
  if (!existsSync(MASTER)) fail(`arte-mestra não encontrada: ${MASTER}`);

  const { width, ink, bands } = await readInk(MASTER);
  const [wordmark, ...rest] = bands;
  if (!wordmark) fail("nenhuma faixa de conteúdo encontrada na arte-mestra");

  console.log(
    `[brand:assets] arte-mestra ${width}px, palavra ${wordmark.width}x${wordmark.height}` +
      (rest.length ? ` (+${rest.length} faixa(s) de rodapé ignorada(s))` : ""),
  );

  // Peça 1: a palavra isolada (sem o rodapé institucional).
  const wordmarkBox = {
    width: wordmark.width * WORDMARK_SCALE,
    height: wordmark.height * WORDMARK_SCALE,
  };
  const wordmarkBytes = await renderPiece(MASTER, wordmark, wordmarkBox, {
    fit: "inside",
    background: null,
    output: join(PUBLIC, "zaggo-wordmark.png"),
  });
  console.log(
    `[brand:assets] zaggo-wordmark.png ${wordmarkBox.width}x${wordmarkBox.height} (${wordmarkBytes} B)`,
  );

  // Peça 2: o primeiro glifo ("Z"). Vai num quadro quadrado (o glifo tem
  // 136x134, então sem o preenchimento o "Z" sai 1px fora de centro nos
  // derivados quadrados — favicon e ícone do menu).
  const glyphs = splitGlyphs(ink, width, wordmark);
  if (glyphs.length === 0) fail("não foi possível isolar o monograma");
  const monogram = glyphs[0];
  const side = Math.max(monogram.width, monogram.height) * MARK_SCALE;
  const markBytes = await renderPiece(
    MASTER,
    monogram,
    { width: side, height: side },
    {
      fit: "contain",
      background: "#ffffff",
      output: join(PUBLIC, "zaggo-mark.png"),
    },
  );
  console.log(
    `[brand:assets] zaggo-mark.png ${side}x${side} ` +
      `(${glyphs.length} glifo(s) na palavra) (${markBytes} B)`,
  );

  // Ícones derivados do monograma.
  const ICON_SIZES = [16, 32, 48, 64];
  const icoImages = [];
  for (const size of ICON_SIZES) {
    const png = await sharp(join(PUBLIC, "zaggo-mark.png"))
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: "#ffffff" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    icoImages.push({ size, data: png });
    if (size === 32) writeFileSync(join(PUBLIC, "favicon-32x32.png"), png);
  }
  const ico = buildIco(icoImages);
  writeFileSync(join(PUBLIC, "favicon.ico"), ico);
  console.log(`[brand:assets] favicon.ico ${ICON_SIZES.join("/")} (${ico.length} B)`);

  // iOS não renderiza canal alfa: fundo branco obrigatório.
  const apple = await sharp(join(PUBLIC, "zaggo-mark.png"))
    .resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(PUBLIC, "apple-touch-icon.png"), apple);
  console.log(`[brand:assets] apple-touch-icon.png 180 (${apple.length} B)`);
}

main().catch((err) => {
  console.error("[brand:assets] falhou:", err);
  process.exit(1);
});
