import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, Trash2, Plus, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { NoticeBanner } from "@/components/portal/NoticeBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Initials } from "@/components/portal/ProgressBar";
import { modules as seedModules } from "@/data/modules";
import { kanbanColumns } from "@/data/tasks";
import { termsDoc, lgpdDoc } from "@/data/legal";
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

interface UserRow {
  name: string;
  email: string;
  role: "Administrador" | "Gestor" | "Colaborador" | "Auditor";
}

const seedUsers: UserRow[] = [
  { name: "Weverson Rafael", email: "weverson@grupogeos.com.br", role: "Administrador" },
  { name: "Henrique Fernandes", email: "henrique@grupogeos.com.br", role: "Gestor" },
  { name: "Ana Beatriz Silva", email: "ana@grupogeos.com.br", role: "Gestor" },
  { name: "Vitor Eduardo", email: "vitor@grupogeos.com.br", role: "Colaborador" },
  { name: "Rafael Mendes", email: "rafael@grupogeos.com.br", role: "Auditor" },
];

const roleTone = {
  Administrador: "danger",
  Gestor: "info",
  Colaborador: "neutral",
  Auditor: "warning",
} as const;

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
  const [users, setUsers] = useState(seedUsers);
  const [mods, setMods] = useState(seedModules.map((m) => m.name));
  const [cols, setCols] = useState<string[]>([...kanbanColumns]);
  const [newCol, setNewCol] = useState("");
  const [newMod, setNewMod] = useState("");

  return (
    <>
      <PageHeader
        icon={Settings}
        title="Administração"
        subtitle="Usuários, módulos, board e documentos institucionais"
      />
      <NoticeBanner>
        Área restrita a administradores. Nesta demonstração as alterações valem apenas para a sessão
        atual.
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
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
          <TabsTrigger value="board">Colunas do board</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {users.map((u) => (
              <li key={u.email} className="flex flex-wrap items-center gap-3 p-4">
                <Initials name={u.name} className="size-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <select
                  value={u.role}
                  aria-label={`Papel de ${u.name}`}
                  onChange={(e) => {
                    const role = e.target.value as UserRow["role"];
                    setUsers((prev) =>
                      prev.map((p) => (p.email === u.email ? { ...p, role } : p)),
                    );
                    toast.success(`${u.name} agora é ${role}.`);
                  }}
                  className="rounded-md border border-input bg-card px-2 py-1.5 text-xs"
                >
                  {(["Administrador", "Gestor", "Colaborador", "Auditor"] as const).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <StatusBadge tone={roleTone[u.role]}>{u.role}</StatusBadge>
                <DeleteButton
                  label={u.name}
                  onConfirm={() => {
                    setUsers((prev) => prev.filter((p) => p.email !== u.email));
                    toast.success("Usuário removido.");
                  }}
                />
              </li>
            ))}
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
                onClick={() => {
                  if (!newMod.trim()) return;
                  setMods((prev) => [...prev, newMod.trim()]);
                  setNewMod("");
                  toast.success("Módulo adicionado.");
                }}
                className="flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
              >
                <Plus className="size-4" /> Adicionar
              </button>
            </div>
            <ul className="divide-y divide-border">
              {mods.map((m) => (
                <li key={m} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-foreground">{m}</span>
                  <DeleteButton
                    label={m}
                    onConfirm={() => {
                      setMods((prev) => prev.filter((p) => p !== m));
                      toast.success("Módulo removido.");
                    }}
                  />
                </li>
              ))}
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
                onClick={() => {
                  if (!newCol.trim()) return;
                  setCols((prev) => [...prev, newCol.trim()]);
                  setNewCol("");
                  toast.success("Coluna adicionada.");
                }}
                className="flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
              >
                <Plus className="size-4" /> Adicionar
              </button>
            </div>
            <ul className="divide-y divide-border">
              {cols.map((c) => (
                <li key={c} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-foreground">{c}</span>
                  <DeleteButton
                    label={c}
                    onConfirm={() => {
                      setCols((prev) => prev.filter((p) => p !== c));
                      toast.success("Coluna removida.");
                    }}
                  />
                </li>
              ))}
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
