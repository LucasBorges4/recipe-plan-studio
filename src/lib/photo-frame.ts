/**
 * Proporção única de foto do portal: **4:3** (largura:altura).
 *
 * centralized aqui para que a foto seja sempre a mesma proporção em qualquer
 * tela — cartão da equipe, avatar do painel, atrelagem no perfil, perfil
 * público e o upload do usuário. Antes as fotos mantinham a proporção de
 * origem (0,67 a 1,0) e cada componente cortava de um jeito, o que fazia o
 * mesmo rosto aparecer com proporções diferentes dependendo da tela.
 *
 * O mesmo recorte é usado em dois lugares, e precisa continuar igual:
 *   - `cropTo43` no upload de `/perfil` (canvas no navegador);
 *   - `scripts/sync-team-photos.mjs` (recorte das fotos versionadas no repo).
 */

/** Largura:altura canônica. */
export const PHOTO_ASPECT = 4 / 3;

/** Classe CSS equivalente (Tailwind não tem `aspect-4/3` pronto). */
export const PHOTO_ASPECT_CSS = "aspect-[4/3]";

/**
 * Moldura padrão de uma foto: proporção travada em 4:3 e preenchimento por
 * `object-cover`, para que qualquer imagem caiba sem distorcer.
 *
 * Aplicar em conjunto com uma altura (`h-16`) ou largura (`w-24`): a outra
 * dimensão sai do `aspect-[4/3]`.
 */
export const PHOTO_FRAME = `${PHOTO_ASPECT_CSS} object-cover`;

/**
 * Quanto do papel excedente fica **acima** do corte, em fração da sobra
 * vertical (0 = topo colado, 0,5 = centralizado, 1 = base colada).
 *
 * Retratos de pessoa têm o rosto no terço superior; centralizar cortaria a
 * linha do cabelo nas fotos mais altas. 0,3 mantém a cabeça e ainda sobra
 * ombro para baixo.
 */
export const HEADROOM = 0.3;

export interface CropRect {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/**
 * Recorte 4:3 para uma imagem de `width` x `height`, aplicando o `HEADROOM`
 * na vertical e centralizando na horizontal.
 *
 * Pensado para o `drawImage(img, sx, sy, w, h, 0, 0, dw, dh)` do canvas e para
 * o `extract()` do sharp — mesma semântica de origem/destino.
 */
export function cropTo43(width: number, height: number): CropRect {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0) {
    throw new Error(`cropTo43: largura inválida (${width}).`);
  }
  if (height <= 0) {
    throw new Error(`cropTo43: altura inválida (${height}).`);
  }

  if (width / height > PHOTO_ASPECT) {
    // Fonte larga: corta as laterais, mantendo a altura.
    const w = Math.round(height * PHOTO_ASPECT);
    return { sx: Math.round((width - w) / 2), sy: 0, width: w, height };
  }

  if (height / width > 1 / PHOTO_ASPECT) {
    // Fonte alta: corta a altura, preservando o headroom.
    const h = Math.round(width / PHOTO_ASPECT);
    return { sx: 0, sy: Math.round((height - h) * HEADROOM), width, height: h };
  }

  return { sx: 0, sy: 0, width, height };
}
