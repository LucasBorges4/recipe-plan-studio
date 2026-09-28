/**
 * Tipos do script de sincronização de fotos, para que os testes em
 * `src/lib/__tests__/photo-frame-sync.test.ts` possam importar a geometria do
 * recorte 4:3 e garantir que ela é a mesma do app (`src/lib/photo-frame.ts`).
 */
export declare const PHOTO_ASPECT: number;
export declare const HEADROOM: number;
export declare function cropRect(
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number };
