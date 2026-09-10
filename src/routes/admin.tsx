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
  Search,
  Filter,
  ShieldCheck,
  Eye,
  RefreshCw,
  Users,
  CheckCircle2,
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
import {
  roles,
  roleLabel,
  roleFunctionsData,
  getRoleBasePermissions,
  getEffectivePermissions,
  permissionsForFunctions,
  userCan,
} from "@/lib/rbac";
import type { Role, PublicUser, Permission } from "@/lib/rbac";
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
  createTechStackFn,
  deleteTechStackFn,
  generateAutoRisksFn,
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
      { title: "Administração — Portal de Governança Grupo W. Geotec CAFUFV" },
      {
        name: "description",
        content:
          "Gestão de usuários e papéis, módulos do sistema, colunas do board e versões dos documentos institucionais.",
      },
      { property: "og:title", content: "Administração — Grupo W. Geotec CAFUFV" },
      {
        property: "og:description",
        content: "Configuração do Portal de Governança do Grupo W. Geotec CAFUFV.",
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

/** Atalhos de delegação por módulo — concede conjuntos de funções de uma vez. */
const moduleDelegation: Array<{
  label: string;
  icon: string;
  keys: string[];
  description: string;
}> = [
  {
    label: "Wiki",
    icon: "📚",
    keys: ["wiki.write", "wiki.maintain"],
    description: "Escrever e manter artigos da Wiki",
  },
  {
    label: "Tarefas",
    icon: "✅",
    keys: ["tasks.manage", "tasks.move", "tasks.approve", "tasks.comment"],
    description: "Criar, mover, aprovar e comentar tarefas",
  },
  {
    label: "Diário de Bordo",
    icon: "📓",
    keys: ["journal.manage"],
    description: "Gerenciar marcos e releases do diário",
  },
  {
    label: "Compliance",
    icon: "🛡️",
    keys: ["evidence.attach", "evidence.review", "compliance.validate", "audit.read"],
    description: "Anexar e revisar evidências, validar conformidade",
  },
  {
    label: "Mapa de Riscos",
    icon: "⚠️",
    keys: ["risks.manage", "risks.monitor"],
    description: "Gerenciar e monitorar riscos e mitigações",
  },
];

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
  const [activeTab, setActiveTab] = useState<"functions" | "effective">("functions");

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

  // Mutação em lote para delegação rápida por módulo ou reset
  const bulkM = useMutation({
    mutationFn: async (v: { keys: string[]; grant: boolean }) => {
      for (const k of v.keys) {
        if (v.grant && !granted.has(k)) await grantUserFunctionFn({ data: { userId: user.id, functionKey: k } });
        if (!v.grant && granted.has(k)) await revokeUserFunctionFn({ data: { userId: user.id, functionKey: k } });
      }
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.grant ? "Módulo delegado." : "Funções atualizadas.");
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.session });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na delegação em lote."),
  });

  const groups = roles
    .map((role) => ({
      role,
      items: functionCatalog.filter((f) => f.role === role),
    }))
    .filter((g) => g.items.length > 0);

  const basePermissions = new Set(getRoleBasePermissions(user.role));
  const effectivePermissions = new Set(getEffectivePermissions(user));

  const allSystemPermissions: Array<{ key: Permission; label: string; group: string }> = [
    { key: "task.create", label: "Criar Tarefas no Kanban", group: "Tarefas" },
    { key: "task.move", label: "Mover Tarefas entre Colunas", group: "Tarefas" },
    { key: "task.approve", label: "Aprovar Tarefas Concluídas", group: "Tarefas" },
    { key: "task.comment", label: "Comentar em Tarefas", group: "Tarefas" },
    { key: "evidence.attach", label: "Anexar Evidências Técnicas", group: "Compliance" },
    { key: "evidence.review", label: "Revisar/Aprovar Evidências", group: "Compliance" },
    { key: "audit.read", label: "Consultar Trilha de Auditoria", group: "Auditoria" },
    { key: "admin.manage", label: "Gestão Administrativa do Sistema", group: "Administração" },
    { key: "risk.manage", label: "Gerenciar Mapa de Riscos", group: "Riscos" },
    { key: "wiki.write", label: "Escrever/Editar Artigos na Wiki", group: "Wiki" },
    { key: "wiki.delete", label: "Excluir Artigos da Wiki", group: "Wiki" },
    { key: "journal.manage", label: "Gerenciar Diário de Bordo", group: "Diário" },
    { key: "patent.manage", label: "Gerenciar Etapas de Patente", group: "Patentes" },
    { key: "automation.read", label: "Visualizar Automações n8n", group: "Automações" },
    { key: "automation.create", label: "Criar Automações n8n", group: "Automações" },
    { key: "automation.share", label: "Compartlhar Automações por Role", group: "Automações" },
    { key: "automation.admin", label: "Administração Completa do n8n", group: "Automações" },
    { key: "record.manage", label: "Configurar Módulos do Sistema", group: "Administração" },
    { key: "invite.manage", label: "Gerenciar Convites de Cadastro", group: "Administração" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="size-5 text-brand" /> Gestão de Funções — {user.name}
            </DialogTitle>
            <StatusBadge tone={roleTone[user.role]}>{roleLabel[user.role]}</StatusBadge>
          </div>
          <DialogDescription className="text-xs">
            Papel base: <strong>{roleLabel[user.role]}</strong>. Atribua funções específicas ou inspecione a matriz final de permissões efetivas do usuário.
          </DialogDescription>
        </DialogHeader>

        <div className="flex border-b border-border text-xs font-medium">
          <button
            onClick={() => setActiveTab("functions")}
            className={`border-b-2 px-4 py-2.5 transition-colors ${
              activeTab === "functions"
                ? "border-brand font-semibold text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Funções & Módulos ({granted.size} concedida{granted.size !== 1 ? "s" : ""})
          </button>
          <button
            onClick={() => setActiveTab("effective")}
            className={`border-b-2 px-4 py-2.5 transition-colors ${
              activeTab === "effective"
                ? "border-brand font-semibold text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Permissões Efetivas ({effectivePermissions.size} ativa{effectivePermissions.size !== 1 ? "s" : ""})
          </button>
        </div>

        {activeTab === "functions" ? (
          <div className="space-y-4 pt-2">
            {/* Delegação rápida por módulo */}
            <div className="rounded-xl border border-brand/20 bg-brand-soft/10 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">Delegação rápida por módulo</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Conceda em 1 clique todas as funções necessárias para os módulos do sistema.
                  </p>
                </div>
                {granted.size > 0 && (
                  <button
                    disabled={bulkM.isPending}
                    onClick={() => bulkM.mutate({ keys: Array.from(granted), grant: false })}
                    className="flex items-center gap-1 rounded-md border border-danger/30 bg-danger-soft px-2.5 py-1 text-[11px] font-medium text-danger hover:bg-danger-soft/80"
                  >
                    <RefreshCw className="size-3" /> Revogar Todas
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-2">
                {moduleDelegation.map((m) => {
                  const hasAll = m.keys.every((k) => granted.has(k));
                  const hasSome = !hasAll && m.keys.some((k) => granted.has(k));
                  return (
                    <div key={m.label} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {m.icon} {m.label} {hasAll ? "· concedido" : hasSome ? "· parcial" : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{m.description}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{m.keys.join(", ")}</p>
                      </div>
                      <button
                        disabled={bulkM.isPending}
                        onClick={() => bulkM.mutate({ keys: m.keys, grant: !hasAll })}
                        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${hasAll ? "bg-brand text-brand-foreground" : "border border-input"}`}
                      >
                        {hasAll ? "Revogar" : "Conceder"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {groups.map((g) => (
              <section key={g.role}>
                <p className="mb-2 text-xs font-semibold text-foreground">Funções do Perfil {roleLabel[g.role]}</p>
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
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Esta lista consolida as permissões ativas de <strong>{user.name}</strong>, separadas por origem (papel base vs funções concedidas especificamente ao usuário).
            </p>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="px-3 py-2">Permissão do Sistema</th>
                    <th className="px-3 py-2">Categoria</th>
                    <th className="px-3 py-2 text-right">Status & Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {allSystemPermissions.map((p) => {
                    const isBase = basePermissions.has(p.key);
                    const isEffective = effectivePermissions.has(p.key);
                    const isGrantedFunc = isEffective && !isBase;

                    return (
                      <tr key={p.key} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {p.label}
                          <span className="block font-mono text-[10px] text-muted-foreground">{p.key}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{p.group}</td>
                        <td className="px-3 py-2 text-right">
                          {isBase ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              <Check className="size-3" /> Papel Base ({roleLabel[user.role]})
                            </span>
                          ) : isGrantedFunc ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
                              <Plus className="size-3" /> Função Concedida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              Sem Acesso
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
  const techStack = state?.techStack ?? [];
  const [stackName, setStackName] = useState("");
  const [stackCategory, setStackCategory] = useState("");
  const [stackDesc, setStackDesc] = useState("");
  const [stackIcon, setStackIcon] = useState("");

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
  const createStackM = useMutation({
    mutationFn: (v: { name: string; category: string; description: string; icon?: string }) =>
      createTechStackFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      setStackName("");
      setStackCategory("");
      setStackDesc("");
      setStackIcon("");
      toast.success("Stack adicionada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar stack."),
  });
  const deleteStackM = useMutation({
    mutationFn: (v: { name: string }) => deleteTechStackFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Stack removida.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover stack."),
  });
  const autoRiskM = useMutation({
    mutationFn: () => generateAutoRisksFn(),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`${r.data.created} risco(s) gerado(s) automaticamente.`);
        qc.invalidateQueries({ queryKey: qk.portal });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar riscos."),
  });
  const [nuName, setNuName] = useState("");
  const [nuEmail, setNuEmail] = useState("");
  const [nuPass, setNuPass] = useState("");
  const [nuRole, setNuRole] = useState<Role>("desenvolvedor");
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");

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

  // Filtragem e estatísticas dos usuários
  const roleCounts = roles.reduce(
    (acc, r) => {
      acc[r] = users.filter((u) => u.role === r).length;
      return acc;
    },
    {} as Record<Role, number>,
  );

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const q = userSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.jobTitle ?? "").toLowerCase().includes(q) ||
      (u.department ?? "").toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

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
          <TabsTrigger value="stacks">Stacks</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="perfis">Perfis & funções</TabsTrigger>
          <TabsTrigger value="validacao">Validação</TabsTrigger>
          <TabsTrigger value="perigo">Perigo</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4 space-y-4">
          {/* Dashboard Resumo de Distribuição de Papéis */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <button
              onClick={() => setRoleFilter("all")}
              className={`rounded-xl border p-3 text-left transition-all ${
                roleFilter === "all"
                  ? "border-brand bg-brand-soft/20 shadow-sm"
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total de Usuários</span>
                <Users className="size-3.5" />
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">{users.length}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Todos cadastrados</p>
            </button>

            {roles.map((r) => {
              const count = roleCounts[r];
              const isSelected = roleFilter === r;
              return (
                <button
                  key={r}
                  onClick={() => setRoleFilter(isSelected ? "all" : r)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-brand bg-brand-soft/20 shadow-sm"
                      : "border-border bg-card hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <StatusBadge tone={roleTone[r]}>{roleLabel[r]}</StatusBadge>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-foreground">{count}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {count === 1 ? "1 usuário" : `${count} usuários`}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Form de Criação de Usuário */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold text-foreground">Cadastro limpo por papel</h3>
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

          {/* Barra de Busca e Filtro de Usuários */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar usuário por nome, email, cargo ou departamento..."
                className="w-full rounded-md border border-input bg-card pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="mr-1 flex items-center gap-1 text-muted-foreground text-[11px]">
                <Filter className="size-3" /> Filtrar:
              </span>
              <button
                onClick={() => setRoleFilter("all")}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  roleFilter === "all"
                    ? "bg-brand text-brand-foreground font-medium"
                    : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos ({users.length})
              </button>
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                    roleFilter === r
                      ? "bg-brand text-brand-foreground font-medium"
                      : "bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {roleLabel[r]} ({roleCounts[r]})
                </button>
              ))}
            </div>
          </div>

          {/* Tabela / Lista de Usuários */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Exibindo <strong>{filteredUsers.length}</strong> de <strong>{users.length}</strong> usuários
              </span>
              {roleFilter !== "all" || userSearch ? (
                <button
                  onClick={() => {
                    setRoleFilter("all");
                    setUserSearch("");
                  }}
                  className="text-brand hover:underline text-[11px]"
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>

            <ul className="divide-y divide-border">
              {filteredUsers.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/10 transition-colors">
                  <Initials name={u.name} className="size-9 text-xs font-semibold" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{u.name}</p>
                      {u.id === session?.user?.id && (
                        <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                          Você
                        </span>
                      )}
                    </div>
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
                    className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs disabled:opacity-60 font-medium"
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
                    className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-brand/40"
                  >
                    <BadgeCheck className="size-4 text-brand" />
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
              {filteredUsers.length === 0 ? (
                <li className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado para os filtros selecionados.
                </li>
              ) : null}
            </ul>
          </div>

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

        <TabsContent value="stacks" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Stacks de Tecnologia</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastre tecnologias usadas no projeto. Visível em Engenharia; gerenciado apenas pelo admin.
            </p>
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              <input
                value={stackName}
                onChange={(e) => setStackName(e.target.value)}
                placeholder="Nome (ex: React)"
                className="rounded-md border border-input bg-card px-3 py-2 text-xs"
              />
              <input
                value={stackCategory}
                onChange={(e) => setStackCategory(e.target.value)}
                placeholder="Categoria (ex: Frontend)"
                className="rounded-md border border-input bg-card px-3 py-2 text-xs"
              />
              <input
                value={stackIcon}
                onChange={(e) => setStackIcon(e.target.value)}
                placeholder="Ícone (opcional, URL)"
                className="rounded-md border border-input bg-card px-3 py-2 text-xs"
              />
              <input
                value={stackDesc}
                onChange={(e) => setStackDesc(e.target.value)}
                placeholder="Descrição curta"
                className="rounded-md border border-input bg-card px-3 py-2 text-xs md:col-span-4"
              />
            </div>
            <button
              onClick={() =>
                stackName.trim() &&
                stackCategory.trim() &&
                stackDesc.trim() &&
                createStackM.mutate({
                  name: stackName.trim(),
                  category: stackCategory.trim(),
                  description: stackDesc.trim(),
                  ...(stackIcon.trim() ? { icon: stackIcon.trim() } : {}),
                })
              }
              disabled={createStackM.isPending || !stackName.trim() || !stackCategory.trim() || stackDesc.trim().length < 5}
              className="mt-3 inline-flex items-center gap-1 rounded-md bg-brand px-4 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
            >
              <Plus className="size-4" /> {createStackM.isPending ? "Adicionando..." : "Adicionar stack"}
            </button>
            <ul className="mt-4 divide-y divide-border">
              {techStack.map((t) => (
                <li key={t.name} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.name} <span className="text-xs text-muted-foreground">· {t.category}</span></p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <DeleteButton label={t.name} onConfirm={() => deleteStackM.mutate({ name: t.name })} />
                </li>
              ))}
              {techStack.length === 0 ? (
                <li className="py-2.5 text-sm text-muted-foreground">Nenhuma stack cadastrada.</li>
              ) : null}
            </ul>
          </div>
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Mapa de Riscos — Geração Automática</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Gera riscos automaticamente a partir de tarefas atrasadas e controles vencidos. Evita duplicatas por título.
            </p>
            <button
              onClick={() => autoRiskM.mutate()}
              disabled={autoRiskM.isPending}
              className="mt-3 rounded-md bg-brand px-4 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
            >
              {autoRiskM.isPending ? "Gerando..." : "Gerar riscos automaticamente"}
            </button>
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
