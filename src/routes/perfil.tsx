import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { initials } from "@/components/portal/ProgressBar";
import { useSession, qk, useUserSessions, useRevokeSessions } from "@/lib/api-hooks";
import { updateProfileFn, changePasswordFn } from "@/lib/portal-api";
import { roleLabel } from "@/lib/rbac";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — Portal de Governança Grupo Geos" },
      { name: "description", content: "Edite seu nome, cargo, departamento e bio." },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const { data: sessionsRes } = useUserSessions();
  const revokeSessionsM = useRevokeSessions();
  const sessions = sessionsRes?.ok ? sessionsRes.data : [];

  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setJobTitle(user.jobTitle ?? "");
      setDepartment(user.department ?? "");
      setBio(user.bio ?? "");
    }
  }, [user]);

  const mut = useMutation({
    mutationFn: (v: { name?: string; jobTitle?: string; department?: string; bio?: string }) =>
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao alterar senha."),
  });

  if (!user) {
    return (
      <>
        <PageHeader icon={User} title="Meu Perfil" subtitle="Dados pessoais e bio" />
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Faça login para editar seu perfil.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader icon={User} title="Meu Perfil" subtitle="Edite sua bio e dados profissionais" />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-sidebar text-lg font-semibold text-sidebar-primary-foreground">
            {initials(user.name)}
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground">{user.name}</p>
          <StatusBadge tone="brand" className="mt-1">{roleLabel[user.role]}</StatusBadge>
          <p className="mt-2 text-xs text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Papel atribuído pelo administrador</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="grid gap-4">
            <label className="text-xs">
              <span className="text-muted-foreground">Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                maxLength={80}
              />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Cargo</span>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ex: Tech Lead, Product Manager"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                maxLength={80}
              />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Departamento</span>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ex: Tecnologia, Produto"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                maxLength={80}
              />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Bio — escreva sobre você ({bio.length}/300)</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
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
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Senha atual"
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Nova senha</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (≥8)"
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Confirmar nova senha</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  const data: Record<string, string> = {};
                  const n = name.trim();
                  if (n && n !== user.name) data["name"] = n;
                  const jt = jobTitle.trim();
                  if (jt) data["jobTitle"] = jt;
                  const dep = department.trim();
                  if (dep) data["department"] = dep;
                  const b = bio.trim();
                  if (b) data["bio"] = b;
                  mut.mutate(data as never);
                }}
                className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
              >
                <Save className="size-4" />
                {mut.isPending ? "Salvando..." : "Salvar perfil"}
              </button>
            </div>
          </div>
        </div>
      {sessions.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Sessões ativas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {sessions.length} sessão(ões) ativa(s).
          </p>
          <ul className="mt-3 space-y-2">
            {sessions.map((s) => (
              <li key={s.tokenHash} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Criada em: {new Date(s.createdAt).toLocaleDateString("pt-BR")} · Expira em: {new Date(s.expiresAt).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
          <button
            disabled={revokeSessionsM.isPending}
            onClick={() => revokeSessionsM.mutate()}
            className="mt-3 rounded-md bg-danger px-4 py-2 text-xs font-medium text-white hover:bg-danger/90 disabled:opacity-50"
          >
            {revokeSessionsM.isPending ? "Revogando..." : "Revogar todas as sessões"}
          </button>
        </div>
      )}
    </>
  );
}
