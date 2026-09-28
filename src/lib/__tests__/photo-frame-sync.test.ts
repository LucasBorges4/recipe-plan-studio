import { describe, it, expect } from "vitest";
import { cropTo43, PHOTO_ASPECT, HEADROOM } from "@/lib/photo-frame";
import {
  cropRect,
  PHOTO_ASPECT as SCRIPT_ASPECT,
  HEADROOM as SCRIPT_HEADROOM,
} from "../../../scripts/sync-team-photos.mjs";

/**
 * O recorte 4:3 acontece em dois lugares: no upload de /perfil (canvas, via
 * `cropTo43`) e nas fotos versionadas no repo (via `cropRect`, rodado pelo
 * `photos:sync`). Se as constantes divergirem, a mesma pessoa aparece
 * enquadrada de dois jeitos dependendo de onde a foto veio.
 */
describe("photos:sync compartilha a geometria 4:3 com o app", () => {
  it("usa a mesma proporção e o mesmo headroom", () => {
    expect(SCRIPT_ASPECT).toBe(PHOTO_ASPECT);
    expect(SCRIPT_HEADROOM).toBe(HEADROOM);
  });

  it("recorta igual em todas as fontes de foto da equipe", () => {
    const sources: Array<[number, number]> = [
      [455, 512],
      [410, 512],
      [341, 512],
      [343, 512],
      [385, 512],
      [511, 512],
      [512, 512],
      [1200, 900],
      [2000, 500],
    ];
    for (const [w, h] of sources) {
      const { sx, sy, width, height } = cropTo43(w, h);
      expect(cropRect(w, h), `divergência em ${w}x${h}`).toEqual({
        left: sx,
        top: sy,
        width,
        height,
      });
    }
  });
});
