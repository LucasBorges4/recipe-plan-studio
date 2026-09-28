import { cn } from "@/lib/utils";
import { PHOTO_ASPECT_CSS } from "@/lib/photo-frame";
import { photoForName } from "@/lib/team-photos";

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}


/**
 * Avatar simples do portal (usado no painel e na wiki).
 *
 * A foto é sempre 4:3: cada tamanho define só a **altura** e a largura sai de
 * `aspect-[4/3]`. Por isso as classes são `h-*` e não `size-*` — `size-*` fixa
 * largura e altura ao mesmo tempo e o `aspect-ratio` deixa de valer.
 *
 * Foto sincronizada: se `avatarUrl` não estiver definido, tenta resolver pelo
 * nome via `photoForName` (manifest de fotos do projeto).
 */
export function Avatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClasses: Record<string, string> = {
    xs: "h-6 text-[9px]",
    sm: "h-8 text-[10px]",
    md: "h-10 text-xs",
    lg: "h-14 text-sm",
    xl: "h-20 text-lg",
  };

  const resolvedPhoto = avatarUrl ?? photoForName(name);
  const hasAvatar = !!resolvedPhoto;

  return (
    <span
      className={cn(
        `inline-flex items-center justify-center shrink-0 overflow-hidden rounded-lg bg-brand-soft text-brand font-bold ${PHOTO_ASPECT_CSS}`,
        sizeClasses[size],
        className,
      )}
      aria-label={name}
    >
      {hasAvatar ? (
        <img
          src={resolvedPhoto!}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
