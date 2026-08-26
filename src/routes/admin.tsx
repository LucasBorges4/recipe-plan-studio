import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Settings, Trash2, Plus, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Initials } from "@/components/portal/ProgressBar";
import { termsDoc, lgpdDoc } from "@/data/legal";
import { roles, roleLabel } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { useAdminUsers, usePortalData, useSession, qk } from "@/lib/api-hooks";
import {
  setUserRoleFn,
  deleteUserFn,
  addModuleFn,
  removeModuleFn,
  addColumnFn,
  deleteColumnFn,
} from "@/lib/portal-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { InvitesPanel } from "@/components/portal/InvitesPanel";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Gestão de usuários e papéis, módulos do sistema, colunas do board e versões dos documentos institucionais.",
      },
      { property: "og:title", content: "Administração — Grupo Geos" },
      {
        property: "og:description",
        content: "Configuração do Portal de Governança do Grupo Geos.",
      },
    ],
  }),
  component: AdminPage,
});

const roleTone: Record<Role, "danger" | "info" | "neutral" | "warning"> = {
  admin: "danger",
  diretor: "info",
  gestor: "info",
  desenvolvedor: "neutral",
  auditor: "warning",
};

function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          aria-label={`Remover ${label}`}
          className="text-muted-foreground transition-colors hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é permanente e afeta imediatamente as páginas que consomem este registro.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AdminPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = !!session?.user && session.user.role === "admin";
  const persistent = session?.persistent ?? true;

  const { data: usersRes } = useAdminUsers(isAdmin);
  const users = usersRes?.ok ? usersRes.data : [];
  const { data: state } = usePortalData();
  const mods = state?.modules ?? [];
  const cols = state?.columns ?? [];

  const [newCol, setNewCol] = useState("");
  const [newMod, setNewMod] = useState("");

  const setRoleM = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => setUserRoleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao alterar o papel."),
  });
  const deleteUserM = useMutation({
    mutationFn: (v: { userId: string }) => deleteUserFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover usuário."),
  });
  const addModuleM = useMutation({
    mutationFn: (v: { name: string }) => addModuleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      setNewMod("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar módulo."),
  });
  const removeModuleM = useMutation({
    mutationFn: (v: { id: string }) => removeModuleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover módulo."),
  });
  const addColumnM = useMutation({
    mutationFn: (v: { name: string }) => addColumnFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      setNewCol("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar coluna."),
  });
  const removeColumnM = useMutation({
    mutationFn: (v: { name: string }) => deleteColumnFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover coluna."),
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader
          icon={Settings}
          title="Administração"
          subtitle="Usuários, módulos, board e documentos institucionais"
        />
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto size-6 text-warning" />
          <p className="mt-3 text-sm font-medium text-foreground">Acesso restrito</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta área é exclusiva para administradores.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={Settings}
        title="Administração"
        subtitle="Usuários, módulos, board e documentos institucionais"
      />
      <NoticeBanner>
        Área restrita a administradores. As alterações são salvas no banco de dados
        {persistent
          ? " e persistem entre reinicializações."
          : ", mas neste modo o armazenamento é em memória e reinicia a cada instância."}
      </NoticeBanner>

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Papéis controlam o acesso às páginas do Portal. Conceda o papel Administrador apenas a
          usuários que precisam gerenciar configurações.
        </p>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários e papéis</TabsTrigger>
          <TabsTrigger value="convites">Convites</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
          <TabsTrigger value="board">Colunas do board</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                <Initials name={u.name} className="size-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <select
                  value={u.role}
                  aria-label={`Papel de ${u.name}`}
                  disabled={u.id === session?.user?.id}
                  onChange={(e) => setRoleM.mutate({ userId: u.id, role: e.target.value as Role })}
                  className="rounded-md border border-input bg-card px-2 py-1.5 text-xs disabled:opacity-60"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel[r]}
                    </option>
                  ))}
                </select>
                <StatusBadge tone={roleTone[u.role]}>{roleLabel[u.role]}</StatusBadge>
                <DeleteButton
                  label={u.name}
                  onConfirm={() => {
                    if (u.id === session?.user?.id) {
                      toast.error("Você não pode remover a própria conta.");
                      return;
                    }
                    deleteUserM.mutate({ userId: u.id });
                  }}
                />
              </li>
            ))}
            {users.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">Nenhum usuário cadastrado.</li>
            ) : null}
          </ul>
        </TabsContent>

        <TabsContent value="convites" className="mt-4">
          <InvitesPanel />
        </TabsContent>

        <TabsContent value="modulos" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex gap-2">
              <input
                value={newMod}
                onChange={(e) => setNewMod(e.target.value)}
                placeholder="Nome do módulo"
                className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
              />
              <button
                onClick={() => newMod.trim() && addModuleM.mutate({ name: newMod.trim() })}
                className="flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
              >
                <Plus className="size-4" /> Adicionar
              </button>
            </div>
            <ul className="divide-y divide-border">
              {mods.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-foreground">{m.name}</span>
                  <DeleteButton
                    label={m.name}
                    onConfirm={() => removeModuleM.mutate({ id: m.id })}
                  />
                </li>
              ))}
              {mods.length === 0 ? (
                <li className="py-2.5 text-sm text-muted-foreground">Nenhum módulo cadastrado.</li>
              ) : null}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="board" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex gap-2">
              <input
                value={newCol}
                onChange={(e) => setNewCol(e.target.value)}
                placeholder="Nome da coluna"
                className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
              />
              <button
                onClick={() => newCol.trim() && addColumnM.mutate({ name: newCol.trim() })}
                className="flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
              >
                <Plus className="size-4" /> Adicionar
              </button>
            </div>
            <ul className="divide-y divide-border">
              {cols.map((c) => (
                <li key={c} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-foreground">{c}</span>
                  <DeleteButton label={c} onConfirm={() => removeColumnM.mutate({ name: c })} />
                </li>
              ))}
              {cols.length === 0 ? (
                <li className="py-2.5 text-sm text-muted-foreground">Nenhuma coluna cadastrada.</li>
              ) : null}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <ul className="grid gap-4 md:grid-cols-2">
            {[termsDoc, lgpdDoc].map((d) => (
              <li key={d.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{d.title}</p>
                  <StatusBadge tone="success">{d.version}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Última atualização: {d.updatedAt} · {d.clauses.length} cláusulas
                </p>
                <button
                  onClick={() => toast("Nova versão registrada para revisão jurídica.")}
                  className="mt-4 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Registrar nova versão
                </button>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </>
  );
}
