import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { initials } from "@/components/portal/ProgressBar";
import { useSession, qk } from "@/lib/api-hooks";
import { updateProfileFn } from "@/lib/portal-api";
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

  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");

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
    </>
  );
}
