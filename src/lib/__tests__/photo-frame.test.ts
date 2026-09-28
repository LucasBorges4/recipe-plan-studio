import { describe, it, expect } from "vitest";
import { PHOTO_ASPECT, PHOTO_ASPECT_CSS, PHOTO_FRAME, cropTo43 } from "@/lib/photo-frame";

describe("photo-frame (proporção 4:3)", () => {
  it("a proporção canônica é 4:3", () => {
    expect(PHOTO_ASPECT).toBe(4 / 3);
    expect(PHOTO_ASPECT_CSS).toBe("aspect-[4/3]");
    expect(PHOTO_FRAME).toContain("aspect-[4/3]");
    expect(PHOTO_FRAME).toContain("object-cover");
  });
});

describe("cropTo43 (recorte centralizado)", () => {
  it("corta a altura quando a fonte é mais alta que 4:3 (retrato)", () => {
    // 341x512 (retrato estreito) -> 4:3 exige cortar a altura.
    expect(cropTo43(341, 512)).toEqual({ sx: 0, sy: 77, width: 341, height: 256 });
  });

  it("corta a largura ao centro quando a fonte é mais larga que 4:3", () => {
    // 512x300 (panorâmico) -> 4:3 exige cortar a largura, centralizado.
    expect(cropTo43(512, 300)).toEqual({ sx: 56, sy: 0, width: 400, height: 300 });
  });

  it("preserva a margem superior (cabeça) em vez de centralizar na vertical", () => {
    // Retrato 1:1.5: o corte tem que sobrar mais papel em cima do que embaixo,
    // senão a linha do cabelo sai da foto.
    const r = cropTo43(512, 768);
    expect(r).toEqual({ sx: 0, sy: 115, width: 512, height: 384 });
    expect(r.sy).toBeLessThan((768 - r.height) / 2);
  });

  it("não altera a fonte que já é 4:3", () => {
    expect(cropTo43(800, 600)).toEqual({ sx: 0, sy: 0, width: 800, height: 600 });
  });

  it("sempre devolve 4:3 com coordenadas inteiras e dentro da fonte", () => {
    const sources: Array<[number, number]> = [
      [455, 512],
      [410, 512],
      [341, 512],
      [511, 512],
      [1200, 900],
      [1000, 1001],
    ];
    for (const [w, h] of sources) {
      const r = cropTo43(w, h);
      expect(Number.isInteger(r.sx)).toBe(true);
      expect(Number.isInteger(r.sy)).toBe(true);
      expect(Number.isInteger(r.width)).toBe(true);
      expect(Number.isInteger(r.height)).toBe(true);
      expect(r.width / r.height).toBeCloseTo(4 / 3, 2);
      expect(r.sx).toBeGreaterThanOrEqual(0);
      expect(r.sy).toBeGreaterThanOrEqual(0);
      expect(r.sx + r.width).toBeLessThanOrEqual(w);
      expect(r.sy + r.height).toBeLessThanOrEqual(h);
    }
  });

  it("rejeita dimensões inválidas em vez de gerar recorte degenerado", () => {
    expect(() => cropTo43(0, 100)).toThrow(/largura/i);
    expect(() => cropTo43(100, 0)).toThrow(/altura/i);
    expect(() => cropTo43(-10, 100)).toThrow(/largura/i);
  });
});
