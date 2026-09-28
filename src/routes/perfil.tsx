import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { updateProfileFn, changePasswordFn } from "@/lib/portal-api";
import { qk } from "@/lib/api-hooks";
import { useSession, useUserSessions, useRevokeSessions } from "@/lib/api-hooks";

import { ProfileSidebar } from "@/components/portal/ProfileSidebar";
import { ProfileForm } from "@/components/portal/ProfileForm";
import { TeamLinking } from "@/components/portal/TeamLinking";
import { SessionsList } from "@/components/portal/SessionsList";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — Portal de Governança GWG — Grupo W. Geotec" },
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
  const [avatarValue, setAvatarValue] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setJobTitle(user.jobTitle ?? "");
      setDepartment(user.department ?? "");
      setBio(user.bio ?? "");
      setAvatarValue(user.avatarUrl ?? null);
    }
  }, [user]);

  const mut = useMutation({
    mutationFn: (v: {
      name?: string;
      jobTitle?: string;
      department?: string;
      bio?: string;
      avatarUrl?: string | null;
    }) => updateProfileFn({ data: v }),
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
        <ProfileSidebar
          name={user.name}
          role={user.role}
          email={user.email}
          avatarValue={avatarValue}
          onAvatarValueChange={setAvatarValue}
        />
        <ProfileForm
          name={name}
          jobTitle={jobTitle}
          department={department}
          bio={bio}
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          avatarValue={avatarValue}
          onNameChange={setName}
          onJobTitleChange={setJobTitle}
          onDepartmentChange={setDepartment}
          onBioChange={setBio}
          onCurrentPasswordChange={setCurrentPassword}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onAvatarValueChange={setAvatarValue}
        />
      </div>
      <TeamLinking userId={user.id ?? undefined} teamMemberId={user.teamMemberId ?? undefined} />
      <SessionsList sessions={sessions} />
    </>
  );
}
