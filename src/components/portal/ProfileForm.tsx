import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { updateProfileFn, changePasswordFn } from "@/lib/portal-api";
import { qk } from "@/lib/api-hooks";

interface ProfileFormProps {
  name: string;
  jobTitle: string;
  department: string;
  bio: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  avatarValue: string | null;
  onNameChange: (v: string) => void;
  onJobTitleChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onBioChange: (v: string) => void;
  onCurrentPasswordChange: (v: string) => void;
  onNewPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
  onAvatarValueChange: (v: string | null) => void;
}

export function ProfileForm({
  name,
  jobTitle,
  department,
  bio,
  currentPassword,
  newPassword,
  confirmPassword,
  avatarValue,
  onNameChange,
  onJobTitleChange,
  onDepartmentChange,
  onBioChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onAvatarValueChange,
}: ProfileFormProps) {
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (v: { name?: string; jobTitle?: string; department?: string; bio?: string; avatarUrl?: string | null }) =>
      updateProfileFn({ data: v }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: qk.session });
      qc.invalidateQueries({ queryKey: ["public-users"] });
      toast.success("Perfil atualizado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const changePasswordM = useMutation({
    mutationFn: (v: { currentPassword: string; newPassword: string }) =>
      changePasswordFn({ data: v }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: qk.session });
      toast.success("Senha alterada com sucesso.");
      onCurrentPasswordChange("");
      onNewPasswordChange("");
      onConfirmPasswordChange("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao alterar senha."),
  });

  return (
    <div className="grid gap-4">
      <label className="text-xs">
        <span className="text-muted-foreground">Nome</span>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          maxLength={80}
        />
      </label>
      <label className="text-xs">
        <span className="text-muted-foreground">Cargo</span>
        <input
          value={jobTitle}
          onChange={(e) => onJobTitleChange(e.target.value)}
          placeholder="Ex: Tech Lead, Product Manager"
          className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          maxLength={80}
        />
      </label>
      <label className="text-xs">
        <span className="text-muted-foreground">Departamento</span>
        <input
          value={department}
          onChange={(e) => onDepartmentChange(e.target.value)}
          placeholder="Ex: Tecnologia, Produto"
          className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          maxLength={80}
        />
      </label>
      <label className="text-xs">
        <span className="text-muted-foreground">
          Bio — escreva sobre você ({bio.length}/300)
        </span>
        <textarea
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          placeholder="Conte sua experiência, formação e responsabilidades..."
          className="mt-1 min-h-[96px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          maxLength={300}
          rows={4}
        />
      </label>
      <hr className="border-border" />
      <label className="text-xs">
        <span className="text-muted-foreground">Senha atual</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => onCurrentPasswordChange(e.target.value)}
          placeholder="Senha atual"
          className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs">
        <span className="text-muted-foreground">Nova senha</span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => onNewPasswordChange(e.target.value)}
          placeholder="Nova senha (≥8)"
          className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs">
        <span className="text-muted-foreground">Confirmar nova senha</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          placeholder="Confirme a nova senha"
          className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </label>
      <button
        disabled={changePasswordM.isPending}
        onClick={() => {
          if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error("Preencha todos os campos de senha.");
            return;
          }
          if (newPassword !== confirmPassword) {
            toast.error("As senhas não coincidem.");
            return;
          }
          if (newPassword.length < 8) {
            toast.error("A nova senha deve ter pelo menos 8 caracteres.");
            return;
          }
          changePasswordM.mutate({ currentPassword, newPassword });
        }}
        className="flex items-center justify-center gap-2 rounded-md bg-sidebar-accent px-4 py-2 text-sm font-medium text-sidebar-primary-foreground disabled:opacity-50"
      >
        <Lock className="size-4" />
        {changePasswordM.isPending ? "Alterando..." : "Alterar senha"}
      </button>
      <button
        disabled={mut.isPending}
        onClick={() => {
          const data: Record<string, string | null> = {};
          const n = name.trim();
          if (n && n !== "") data["name"] = n;
          const jt = jobTitle.trim();
          if (jt) data["jobTitle"] = jt;
          const dep = department.trim();
          if (dep) data["department"] = dep;
          const b = bio.trim();
          if (b) data["bio"] = b;
          data["avatarUrl"] = avatarValue === "" ? null : (avatarValue ?? null);
          mut.mutate(data as never);
        }}
        className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
      >
        <Save className="size-4" />
        {mut.isPending ? "Salvando..." : "Salvar perfil"}
      </button>
    </div>
  );
}
