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
  clearAllUsersFn,
  createUserWithRoleFn,
  seedDemoUsersFn,
} from "@/lib/portal-api";
import { roleProfiles } from "@/lib/rbac";
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
  const [nuName, setNuName] = useState("");
  const [nuEmail, setNuEmail] = useState("");
  const [nuPass, setNuPass] = useState("");
  const [nuRole, setNuRole] = useState<Role>("desenvolvedor");
  const createUserM = useMutation({
    mutationFn: (v: { name: string; email: string; password: string; role: Role }) =>
      createUserWithRoleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users });
      toast.success("Usuário criado com role.");
      setNuName("");
      setNuEmail("");
      setNuPass("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar usuário."),
  });
  const seedM = useMutation({
    mutationFn: () => seedDemoUsersFn(),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`${r.data.created} usuário(s) semeados.`);
        qc.invalidateQueries({ queryKey: qk.users });
      }
    },
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
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="usuarios">Usuários e papéis</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
          <TabsTrigger value="board">Colunas do board</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="perfis">Perfis & funções</TabsTrigger>
          <TabsTrigger value="perigo">Perigo</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold text-foreground">Cadastro limpo por role</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie 1 usuário para cada papel. Primeiro acesso pode usar o seed de 5 contas demo.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={nuName}
                onChange={(e) => setNuName(e.target.value)}
                placeholder="Nome"
                className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs"
              />
              <input
                value={nuEmail}
                onChange={(e) => setNuEmail(e.target.value)}
                placeholder="email@grupogeos.com.br"
                className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs"
              />
              <input
                value={nuPass}
                onChange={(e) => setNuPass(e.target.value)}
                placeholder="Senha (≥8)"
                type="password"
                className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs"
              />
              <select
                value={nuRole}
                onChange={(e) => setNuRole(e.target.value as Role)}
                className="rounded-md border border-input bg-card px-3 py-2 text-xs"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel[r]}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  createUserM.mutate({
                    name: nuName.trim(),
                    email: nuEmail.trim(),
                    password: nuPass,
                    role: nuRole,
                  })
                }
                disabled={
                  createUserM.isPending || !nuName.trim() || !nuEmail.trim() || nuPass.length < 8
                }
                className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
              >
                Criar
              </button>
              <button
                onClick={() => seedM.mutate()}
                disabled={seedM.isPending}
                className="rounded-md border border-input px-3 py-2 text-xs"
              >
                {seedM.isPending ? "Semeando..." : "Seed 5 roles"}
              </button>
            </div>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                <Initials name={u.name} className="size-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} {u.jobTitle ? `· ${u.jobTitle}` : ""}{" "}
                    {u.department ? `· ${u.department}` : ""}
                  </p>
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

        <TabsContent value="perfis" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.values(roleProfiles).map((p) => (
              <div key={p.role} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{p.label}</p>
                  <StatusBadge tone="brand">{p.position}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.department}</p>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {p.functions.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Permissões: {p.permissions.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="perigo" className="mt-4">
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-5">
            <h3 className="text-sm font-semibold text-danger">Zona de perigo</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Apaga <strong>todos</strong> os usuários e sessões. O próximo cadastro torna-se admin.
              Use para zerar a base após testes.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="mt-3 rounded-md bg-danger px-4 py-2 text-xs font-medium text-white hover:bg-danger/90">
                  Apagar todos os usuários
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar tudo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso remove permanentemente {users.length} usuário(s) e todas as sessões. Não há
                    desfazer. Digite APAGAR_TUDO para confirmar no backend.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const res = await clearAllUsersFn({ data: { confirm: "APAGAR_TUDO" } });
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.success(
                          `${res.data.deleted} usuário(s) apagados. Faça novo cadastro.`,
                        );
                        qc.invalidateQueries({ queryKey: qk.users });
                        qc.invalidateQueries({ queryKey: qk.session });
                      }
                    }}
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
