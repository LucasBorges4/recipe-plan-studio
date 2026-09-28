import { useState } from "react";
import { User } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { roleLabel, type Role } from "@/lib/rbac";
import { cropTo43, PHOTO_ASPECT_CSS } from "@/lib/photo-frame";
import { initials } from "@/components/portal/ProgressBar";

interface ProfileSidebarProps {
  name: string;
  role: Role;
  email: string;
  avatarValue: string | null;
  onAvatarValueChange: (v: string | null) => void;
}

export function ProfileSidebar({
  name,
  role,
  email,
  avatarValue,
  onAvatarValueChange,
}: ProfileSidebarProps) {
  const [, setUploading] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      {avatarValue ? (
        <img
          src={avatarValue}
          alt="Foto de perfil"
          className={`mx-auto h-20 rounded-lg object-cover shadow-md ring-2 ring-brand/20 ${PHOTO_ASPECT_CSS}`}
          loading="eager"
          decoding="async"
          draggable={false}
        />
      ) : (
        <span
          className={`mx-auto flex h-20 items-center justify-center rounded-lg bg-sidebar text-lg font-semibold text-sidebar-primary-foreground shadow-md ring-2 ring-brand/20 ${PHOTO_ASPECT_CSS}`}
        >
          {initials(name)}
        </span>
      )}
      <p className="mt-3 text-sm font-semibold text-foreground">{name}</p>
      <StatusBadge tone="brand" className="mt-1">
        {roleLabel[role]}
      </StatusBadge>
      <p className="mt-2 text-xs text-muted-foreground">{email}</p>
      <p className="mt-1 text-xs text-muted-foreground">Papel atribuído pelo administrador</p>
      <div className="mt-4 flex flex-col items-center gap-2">
        <label
          htmlFor="avatar-upload"
          className="cursor-pointer rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:bg-brand/90"
        >
          {avatarValue ? "Alterar foto" : "Adicionar foto"}
        </label>
        <input
          id="avatar-upload"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!file.type.match(/image\/(png|jpeg|jpg|webp)/)) {
              toast.error("Formato não suportado. Use png, jpeg ou webp.");
              e.target.value = "";
              return;
            }
            try {
              const compressed = await new Promise<string>((resolve, reject) => {
                const img = new Image();
                const objectUrl = URL.createObjectURL(file);
                img.onload = () => {
                  try {
                    const crop = cropTo43(img.width, img.height);
                    const maxSize = 512;
                    const w = Math.min(crop.width, maxSize);
                    const h = Math.max(1, Math.round((crop.height * w) / crop.width));

                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                      URL.revokeObjectURL(objectUrl);
                      return reject(new Error("Canvas indisponível"));
                    }
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = "high";
                    ctx.fillStyle = "#fff";
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, crop.sx, crop.sy, crop.width, crop.height, 0, 0, w, h);
                    URL.revokeObjectURL(objectUrl);
                    const toWebp = canvas.toDataURL("image/webp", 0.88);
                    const isWebp = toWebp.startsWith("data:image/webp");
                    const outputType = isWebp ? "image/webp" : file.type === "image/png" ? "image/png" : "image/jpeg";
                    resolve(isWebp ? toWebp : canvas.toDataURL(outputType, 0.88));
                  } catch (e) {
                    URL.revokeObjectURL(objectUrl);
                    reject(e);
                  }
                };
                img.onerror = () => {
                  URL.revokeObjectURL(objectUrl);
                  reject(new Error("Falha ao carregar imagem"));
                };
                img.src = objectUrl;
              });
              if (compressed.length > 1_500_000) {
                toast.error("Imagem excede 1.5MB após compressão. Tente outra.");
                e.target.value = "";
                return;
              }
              onAvatarValueChange(compressed);
              toast.success("Foto selecionada. Salve o perfil para confirmar.");
            } catch {
              toast.error("Falha ao processar a imagem.");
            } finally {
              e.target.value = "";
            }
          }}
        />
        {avatarValue !== null && (
          <button
            type="button"
            onClick={() => {
              onAvatarValueChange("");
              toast.info("Foto removida. Salve o perfil para confirmar.");
            }}
            className="rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger/90"
          >
            Remover foto
          </button>
        )}
      </div>
    </div>
  );
}
