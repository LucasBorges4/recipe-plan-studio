import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Settings,
  Trash2,
  Plus,
  ShieldAlert,
  UserPlus,
  BadgeCheck,
  Check,
  X,
  Download,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Initials } from "@/components/portal/ProgressBar";
import {
  useAdminUsers,
  usePortalData,
  useRoleFunctions,
  useSession,
  qk,
  useInvites,
} from "@/lib/api-hooks";
import { roles, roleLabel, roleFunctionsData } from "@/lib/rbac";
import type { Role, PublicUser } from "@/lib/rbac";
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
  promoteSelfFn,
  grantUserFunctionFn,
  revokeUserFunctionFn,
  exportBackupFn,
  importBackupFn,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** Catálogo plano de funções concedíveis (fonte: rbac), agrupadas por perfil. */
const functionCatalog: Array<{ key: string; description: string; role: Role }> = Object.entries(
  roleFunctionsData,
).flatMap(([r, fns]) =>
  fns.map((f) => ({ key: f.key, description: f.description, role: r as Role })),
);

/** Controle do admin: concede/revoga funções individuais de um usuário. */
function UserFunctionsDialog({
  user,
  open,
  onClose,
}: {
  user: PublicUser;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const granted = new Set(user.functions ?? []);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const toggleM = useMutation({
    mutationFn: async (v: { functionKey: string; grant: boolean }) => {
      setPendingKey(v.functionKey);
      const res = v.grant
        ? await grantUserFunctionFn({ data: { userId: user.id, functionKey: v.functionKey } })
        : await revokeUserFunctionFn({ data: { userId: user.id, functionKey: v.functionKey } });
      return { res, ...v };
    },
    onSuccess: ({ res, grant }) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(grant ? "Função concedida." : "Função revogada.");
        qc.invalidateQueries({ queryKey: qk.users });
        qc.invalidateQueries({ queryKey: qk.session });
      }
    },
    onSettled: () => setPendingKey(null),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao alterar função."),
  });

  const groups = roles
    .map((role) => ({
      role,
      items: functionCatalog.filter((f) => f.role === role),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Funções de {user.name}</DialogTitle>
          <DialogDescription>
            Conceda ao usuário funções além do papel base ({roleLabel[user.role]}). As funções
            desbloqueiam permissões correspondentes; o papel continua sendo a base de acesso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.role}>
              <p className="mb-2 text-xs font-semibold text-foreground">{roleLabel[g.role]}</p>
              <ul className="space-y-1.5">
                {g.items.map((f) => {
                  const isGranted = granted.has(f.key);
                  const pending = pendingKey === f.key;
                  return (
                    <li
                      key={f.key}
                      className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                        isGranted ? "border-brand/40 bg-brand-soft/30" : "border-border"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-foreground">{f.description}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {f.key}
                        </p>
                      </div>
                      <button
                        disabled={pending}
                        onClick={() => toggleM.mutate({ functionKey: f.key, grant: !isGranted })}
                        aria-pressed={isGranted}
                        className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                          isGranted
                            ? "bg-brand text-brand-foreground"
                            : "border border-input text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {pending ? (
                          "…"
                        ) : isGranted ? (
                          <>
                            <Check className="size-3" /> Concedida
                          </>
                        ) : (
                          <>
                            <X className="size-3" /> Conceder
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {granted.size > 0 ? (
            <p className="text-xs text-muted-foreground">
              {granted.size} função(ões) concedida(s) além do papel base.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Seção "Perfis" — funções vindas do banco (fonte de verdade);
 *  usa roleProfiles apenas para position/department/permissions e exibe a matriz de permissões de alteração do ambiente. */
function PerfisSection() {
  const { data: rf, isLoading } = useRoleFunctions();
  const funcsByRole = new Map<Role, string[]>();
  (rf?.ok ? rf.data : []).forEach((item) => {
    const cur = funcsByRole.get(item.role as Role) ?? [];
    cur.push(item.description);
    funcsByRole.set(item.role as Role, cur);
  });

  const environmentPermissions = [
    {
      action: "Configurar Módulos do Sistema",
      permission: "modules.configure / record.manage",
      roles: "Admin, Diretor, Gestor",
      grantable: "Sim (Aba Usuários > Funções)",
    },
    {
      action: "Adicionar / Remover Colunas do Board",
      permission: "admin.manage / task.create",
      roles: "Admin, Gestor",
      grantable: "Sim (Aba Usuários > Funções)",
    },
    {
      action: "Políticas de Segurança e Acesso",
      permission: "security.policy / admin.manage",
      roles: "Admin",
      grantable: "Sim (Aba Usuários > Funções)",
    },
    {
      action: "Gerenciar Automações & Webhooks n8n",
      permission: "automations.manage / automation.admin",
      roles: "Admin",
      grantable: "Sim (Aba Usuários > Funções)",
    },
    {
      action: "Backup e Restauração do Banco de Dados",
      permission: "backup.manage / admin.manage",
      roles: "Admin",
      grantable: "Sim (Aba Usuários > Funções)",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {Object.values(roleProfiles).map((p) => {
          const fns = funcsByRole.get(p.role) ?? roleProfiles[p.role].functions ?? [];
          return (
            <div key={p.role} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{p.label}</p>
                <StatusBadge tone="brand">{p.position}</StatusBadge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.department}</p>
              {isLoading ? (
                <p className="mt-3 text-xs text-muted-foreground">Carregando funções…</p>
              ) : (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {fns.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Permissões: {p.permissions.join(", ")}
              </p>
            </div>
          );
        })}
      </div>

      {/* Matriz de Permissões para Alteração do Ambiente */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Matriz de Permissões para Alteração do Ambiente
          </h3>
          <p className="text-xs text-muted-foreground">
            O Administrador pode configurar e atribuir qualquer uma destas permissões individualmente a usuários de qualquer papel através do botão <strong>"Funções"</strong> na aba Usuários.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border/80">
              <tr>
                <th className="px-3 py-2">Alteração do Ambiente</th>
                <th className="px-3 py-2">Permissão Técnica</th>
                <th className="px-3 py-2">Papéis Nativos</th>
                <th className="px-3 py-2">Atribuição pelo Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {environmentPermissions.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium text-foreground">{row.action}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-brand">{row.permission}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.roles}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      {row.grantable}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Backup/restauração manual — permite preservar dados mesmo em runtimes sem
 *  armazenamento persistente (ex.: edge), baixando/restaurando um JSON do dump. */
function BackupSection() {
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const lastBackup = state?.lastBackupAt;
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ name: string; payload: unknown } | null>(null);

  const backupM = useMutation({
    mutationFn: () => exportBackupFn(),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const stamp = r.data.summary.exportedAt.replace(/[:T.]/g, "-").slice(0, 15);
      downloadJson(`portal-backup-${stamp}.json`, r.data.dump);
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success(`Backup baixado (${r.data.summary.sizeKb} kB).`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao exportar backup."),
  });

  const restoreM = useMutation({
    mutationFn: (v: { payload: unknown }) =>
      importBackupFn({ data: { confirm: "RESTAURAR", payload: v.payload } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDraft(null);
      qc.invalidateQueries({ queryKey: qk.portal });
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.session });
      toast.success("Backup restaurado com sucesso.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao restaurar backup."),
  });

  const onFile: React.ChangeEventHandler<HTMLInputElement> = (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        const obj = parsed as Record<string, unknown>;
        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed) ||
          !("exportedAt" in obj) ||
          !("users" in obj)
        ) {
          toast.error("O arquivo não parece um backup do portal.");
          return;
        }
        setDraft({ name: file.name, payload: parsed });
        toast.success("Arquivo carregado — confirme a restauração abaixo.");
      } catch {
        toast.error("Arquivo não é um JSON válido.");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Download className="size-4" /> Backup e restauração
      </h3>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Faça download do estado completo (JSON) e restaure depois de um novo deploy. Útil quando o
        ambiente não oferece armazenamento persistente.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => backupM.mutate()}
          disabled={backupM.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
        >
          <Download className="size-3.5" />
          {backupM.isPending ? "Gerando…" : "Baixar backup"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={restoreM.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Upload className="size-3.5" />
          {restoreM.isPending ? "Restaurando…" : "Restaurar backup"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFile}
        />
        {lastBackup ? (
          <span className="text-xs text-muted-foreground">
            Último backup:{" "}
            <span className="font-mono">{lastBackup.replace("T", " ").slice(0, 19)}</span>
          </span>
        ) : null}
      </div>
      {draft ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
              <Upload className="size-3.5" />
              Restaurar {draft.name}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar backup?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso substitui <strong>todos</strong> os dados atuais pelos do arquivo{" "}
                <span className="font-mono">{draft.name}</span>. A operação não pode ser revertida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => restoreM.mutate({ payload: draft.payload })}
                disabled={restoreM.isPending}
              >
                {restoreM.isPending ? "Restaurando…" : "Confirmar restauração"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
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
  const { data: invitesRes } = useInvites();
  const invites = invitesRes?.ok ? invitesRes.data : [];
  const mods = state?.modules ?? [];
  const cols = state?.columns ?? [];

  const [newCol, setNewCol] = useState("");
  const [newMod, setNewMod] = useState("");
  const [functionTarget, setFunctionTarget] = useState<PublicUser | null>(null);

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
  const recoverM = useMutation({
    mutationFn: () => promoteSelfFn(),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.error);
      } else {
        toast.success("Você agora é administrador! Recarregando…");
        window.location.reload();
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na recuperação."),
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
          <div className="mt-6 space-y-3">
            <p className="text-xs text-muted-foreground">
              Nenhum administrador foi encontrado no sistema. O próximo cadastro normalmente
              torna-se admin, mas você também pode se auto-recuperar abaixo.
            </p>
            <button
              onClick={() => recoverM.mutate()}
              disabled={recoverM.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              <UserPlus className="size-4" />
              {recoverM.isPending ? "Promovendo…" : "Tornar-me administrador"}
            </button>
          </div>
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
        {state?.storagePath ? ` Caminho: ${state.storagePath}` : ""}
        {state?.storageInitError ? ` Erro: ${state.storageInitError}` : ""}
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
          <TabsTrigger value="convites">Convites</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
          <TabsTrigger value="board">Colunas do board</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="perfis">Perfis & funções</TabsTrigger>
          <TabsTrigger value="validacao">Validação</TabsTrigger>
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
                <button
                  onClick={() => setFunctionTarget(u)}
                  className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <BadgeCheck className="size-4" />
                  Funções
                  {u.functions?.length ? (
                    <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground">
                      {u.functions.length}
                    </span>
                  ) : null}
                </button>
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
          {functionTarget ? (
            <UserFunctionsDialog
              user={functionTarget}
              open={!!functionTarget}
              onClose={() => setFunctionTarget(null)}
            />
          ) : null}
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
            {(state?.legalDocs ?? []).map((d) => (
              <li key={d.id} className="rounded-xl border border-border bg-card p-5">
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
          <PerfisSection />
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

        <TabsContent value="validacao" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Checklist de entrega</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Valide os pré-requisitos antes da implantação.
            </p>
            <ul className="mt-4 space-y-3">
              <li className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Persistência ativa</p>
                  <p className="text-xs text-muted-foreground">
                    {state?.persistent ? "SQLite em disco" : "Modo memória — dados voláteis"}
                    {state?.persistent && state?.storagePath ? ` (${state.storagePath})` : ""}
                  </p>
                </div>
                <StatusBadge tone={state?.persistent ? "success" : "danger"}>
                  {state?.persistent ? "OK" : "Atenção"}
                </StatusBadge>
              </li>
              <li className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Administrador criado</p>
                  <p className="text-xs text-muted-foreground">
                    {(users as Array<{ role: string }>).filter((u) => u.role === "admin").length}{" "}
                    admin(s) encontrado(s)
                  </p>
                </div>
                <StatusBadge
                  tone={
                    (users as Array<{ role: string }>).some((u) => u.role === "admin")
                      ? "success"
                      : "danger"
                  }
                >
                  {(users as Array<{ role: string }>).some((u) => u.role === "admin")
                    ? "OK"
                    : "Faltando"}
                </StatusBadge>
              </li>
              <li className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Documentos publicados</p>
                  <p className="text-xs text-muted-foreground">
                    {state?.legalDocs?.filter((d) => d.slug === "termos" || d.slug === "lgpd")
                      .length ?? 0}{" "}
                    de 2
                  </p>
                </div>
                <StatusBadge
                  tone={
                    (state?.legalDocs?.filter((d) => d.slug === "termos" || d.slug === "lgpd")
                      .length ?? 0) >= 2
                      ? "success"
                      : "warning"
                  }
                >
                  {(state?.legalDocs?.filter((d) => d.slug === "termos" || d.slug === "lgpd")
                    .length ?? 0) >= 2
                    ? "OK"
                    : "Incompleto"}
                </StatusBadge>
              </li>
              <li className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Convites ativos</p>
                  <p className="text-xs text-muted-foreground">
                    {invites.filter((i) => i.status === "Pendente").length} pendente(s)
                  </p>
                </div>
                <StatusBadge
                  tone={invites.some((i) => i.status === "Pendente") ? "success" : "neutral"}
                >
                  {invites.some((i) => i.status === "Pendente") ? "OK" : "Sem convites"}
                </StatusBadge>
              </li>
            </ul>
          </div>
          <BackupSection />
        </TabsContent>
      </Tabs>
    </>
  );
}
