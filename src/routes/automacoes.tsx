import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Shield, ExternalLink, Lock, Users, Share2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { useSession } from "@/lib/api-hooks";
import { roles, roleLabel, can } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { getN8nInfoFn, listAutomationSharesFn, upsertAutomationShareFn, deleteAutomationShareFn, provisionN8nUserFn, createN8nWorkflowFn, deleteN8nWorkflowFn, listN8nWorkflowsFn } from "@/lib/portal-api";
import type { N8nWorkflow } from "@/server/n8n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/automacoes")({
  head: () => ({
    meta: [{ title: "Automações — Portal Grupo Geos" }],
  }),
  component: AutomacoesPage,
});

function AutomacoesPage() {
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const role = user?.role ?? "desenvolvedor";
  const qc = useQueryClient();

  const { data: n8nInfo } = useQuery({ queryKey: ["n8n-info"], queryFn: () => getN8nInfoFn() });
  const n8nUrl = n8nInfo?.publicUrl ?? n8nInfo?.url ?? "http://127.0.0.1:5679";

  const { data: sharesRes } = useQuery({
    queryKey: ["automation-shares"],
    queryFn: () => listAutomationSharesFn(),
    enabled: !!user,
  });
  const shares = sharesRes?.ok ? sharesRes.data : [];

  const [wfId, setWfId] = useState("");
  const [wfName, setWfName] = useState("");
  const [sharedRole, setSharedRole] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [newWfName, setNewWfName] = useState("");

  const { data: n8nWorkflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ["n8n-workflows"],
    queryFn: () => listN8nWorkflowsFn(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const workflows: N8nWorkflow[] = (n8nWorkflows?.ok ? n8nWorkflows.data : []) ?? [];

  const createWfM = useMutation({
    mutationFn: (name: string) => createN8nWorkflowFn({ data: { name } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["n8n-workflows"] });
      toast.success("Workflow criado no n8n.");
      setNewWfName("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar workflow."),
  });

  const deleteWfM = useMutation({
    mutationFn: (id: number) => deleteN8nWorkflowFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["n8n-workflows"] });
      toast.success("Workflow removido do n8n.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover workflow."),
  });

  const upsertM = useMutation({
    mutationFn: (v: { workflowId: string; workflowName: string; sharedRole: Role | null; isPrivate: boolean }) =>
      upsertAutomationShareFn({ data: v as never }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-shares"] });
      qc.invalidateQueries({ queryKey: ["n8n-workflows"] });
      toast.success("Automação salva.");
      setWfId(""); setWfName("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const deleteM = useMutation({
    mutationFn: (v: { id: string }) => deleteAutomationShareFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automation-shares"] }); qc.invalidateQueries({ queryKey: ["n8n-workflows"] }); toast.success("Removida."); },
  });

  const provisionM = useMutation({
    mutationFn: () => provisionN8nUserFn(),
    onSuccess: (r) => { if (r.ok) toast.success(r.data.message); else toast.error(r.error); },
  });

  if (!user) {
    return (
      <>
        <PageHeader icon={Bot} title="Automações" subtitle="Faça login para gerenciar suas automações n8n" />
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Entre com sua conta do portal (mesma conta usada no n8n).</div>
      </>
    );
  }

  const canCreate = can(role, "automation.create");
  const isSuperior = can(role, "automation.admin") || role === "admin" || role === "diretor";

  return (
    <>
      <PageHeader icon={Bot} title="Automações" subtitle={`n8n · login com seu e-mail do portal (${user.email}) · IP ${n8nUrl}`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <a href={n8nUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">
          <ExternalLink className="size-4" /> Abrir n8n ({n8nUrl})
        </a>
        <button onClick={() => provisionM.mutate()} className="rounded-md border border-input px-4 py-2 text-sm">Meu acesso n8n</button>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <Shield className="size-3" /> Role: {roleLabel[role]} {isSuperior ? "· visão superior" : ""}
        </span>
      </div>

      <Tabs defaultValue={role}>
        <TabsList className="flex flex-wrap">
          {roles.map((r) => (
            <TabsTrigger key={r} value={r} className="text-xs">
              {roleLabel[r]}
            </TabsTrigger>
          ))}
          <TabsTrigger value="geral" className="text-xs">Geral (compartilhadas)</TabsTrigger>
        </TabsList>

        {roles.map((r) => (
          <TabsContent key={r} value={r} className="mt-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">Aba exclusiva — {roleLabel[r]}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {r === role
                  ? "Esta é sua aba. Crie automações e decida quem pode ver (privado / por role / público). Roles superiores (admin, diretor) enxergam todas."
                  : isSuperior || r === role
                    ? `Visualizando automações da role ${roleLabel[r]}. Você tem permissão superior.`
                    : `Aba de ${roleLabel[r]} — acesso restrito. Apenas membros da role e superiores visualizam.`}
              </p>
              <div className="mt-4 grid gap-2">
                {shares.filter((s) => s.ownerRole === r).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma automação registrada para {roleLabel[r]}.</p>
                ) : (
                  shares.filter((s) => s.ownerRole === r).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{s.workflowName} <span className="text-xs text-muted-foreground">({s.workflowId})</span></p>
                        <p className="text-xs text-muted-foreground">Dono: {s.ownerName} · {s.isPrivate ? "Privado" : s.sharedRole ? `Compartilhado: ${roleLabel[s.sharedRole as Role]}` : "Público (todas roles)"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={`${n8nUrl}/workflow/${s.workflowId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">Abrir</a>
                        {(s.ownerId === user.id || isSuperior) && (
                          <button onClick={() => deleteM.mutate({ id: s.id })} className="text-muted-foreground hover:text-danger"><Trash2 className="size-4" /></button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-border bg-surface p-3">
                <p className="text-xs font-medium">n8n embarcado — {roleLabel[r]}</p>
                <iframe title={`n8n-${r}`} src={n8nUrl} className="mt-2 h-[520px] w-full rounded-md border border-border bg-white" loading="lazy" />
                <p className="mt-2 text-[11px] text-muted-foreground">Dica: no n8n, crie o usuário com o mesmo e-mail do portal na primeira abertura. Depois copie o Workflow ID e registre abaixo para controlar o compartilhamento por role.</p>
              </div>
            </div>
          </TabsContent>
        ))}

        <TabsContent value="geral" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4" /> Automações compartilhadas</h3>
            <div className="mt-3 grid gap-2">
              {shares.filter((s) => !s.isPrivate).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma automação compartilhada ainda.</p>
              ) : (
                shares.filter((s) => !s.isPrivate).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{s.workflowName}</p>
                      <p className="text-xs text-muted-foreground">{s.ownerName} ({roleLabel[s.ownerRole as Role]}) → {s.sharedRole ? roleLabel[s.sharedRole as Role] : "todas"}</p>
                    </div>
                    <a href={`${n8nUrl}/workflow/${s.workflowId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">Abrir no n8n</a>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {canCreate && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4" /> Gerenciar workflows no n8n</h3>
          <p className="mt-1 text-xs text-muted-foreground">Crie e gerencie workflows diretamente pela API do n8n. Criar um workflow também o registra automaticamente para compartilhamento.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={newWfName} onChange={(e) => setNewWfName(e.target.value)} placeholder="Nome do novo workflow" className="min-w-40 flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs" />
            <button
              disabled={!newWfName.trim() || createWfM.isPending}
              onClick={() => createWfM.mutate(newWfName.trim())}
              className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
            >
              {createWfM.isPending ? "Criando..." : "Criar no n8n"}
            </button>
          </div>
          {workflowsLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Carregando workflows...</p>
          ) : workflows.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Nenhum workflow encontrado no n8n.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {workflows.map((wf) => (
                <div key={wf.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{wf.name} <span className="text-xs text-muted-foreground">(ID: {wf.id})</span></p>
                    <p className="text-xs text-muted-foreground">{wf.active ? "Ativo" : "Inativo"} · {wf.nodes.length} nó(s)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`${n8nUrl}/workflow/${wf.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">Abrir</a>
                    {(isSuperior || String(wf.userId) === user?.id) && (
                      <button onClick={() => deleteWfM.mutate(wf.id)} disabled={deleteWfM.isPending} className="text-muted-foreground hover:text-danger disabled:opacity-50"><Trash2 className="size-4" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <hr className="my-4 border-border" />
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Lock className="size-4" /> Registrar / compartilhar automação</h3>
          <p className="mt-1 text-xs text-muted-foreground">Após criar o workflow no n8n, registre-o aqui para gerir a visibilidade. Apenas você (dono) e roles superiores podem alterar. Privado = só você vê.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={wfId} onChange={(e) => setWfId(e.target.value)} className="min-w-40 flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs">
              <option value="">-- selecione um workflow --</option>
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>{wf.name} (ID: {wf.id})</option>
              ))}
            </select>
            <input value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="Nome do workflow" className="min-w-40 flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs" />
            <select value={sharedRole} onChange={(e) => setSharedRole(e.target.value)} className="rounded-md border border-input bg-card px-3 py-2 text-xs">
              <option value="">-- visibilidade --</option>
              <option value="__public">Público (todas roles)</option>
              {roles.map((r) => (<option key={r} value={r}>{roleLabel[r]}</option>))}
            </select>
            <label className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-xs">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Privado
            </label>
            <button
              disabled={!wfId || !wfName.trim() || upsertM.isPending}
              onClick={() => {
                const sr = sharedRole === "__public" ? null : (sharedRole as Role | null);
                upsertM.mutate({ workflowId: wfId, workflowName: wfName.trim(), sharedRole: isPrivate ? null : sr, isPrivate });
              }}
              className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="size-3" /> Grupo: quem cria é dono; pode liberar para uma role específica ou para todos; privado fica só com o dono até liberar.</p>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-warning/25 bg-warning-soft p-4 text-xs text-warning">
        <p className="font-semibold">MCP Lovable — como integrar</p>
        <p className="mt-1">URL n8n: <code className="rounded bg-white px-1 py-0.5">{n8nUrl}</code> · API: <code className="rounded bg-white px-1 py-0.5">{n8nUrl}/api/v1</code></p>
        <p className="mt-1">No Lovable: adicione um MCP Server do tipo HTTP/SSE com URL <code className="rounded bg-white px-1 py-0.5">{n8nUrl}/mcp</code> ou use Webhook URL <code className="rounded bg-white px-1 py-0.5">{n8nUrl}/webhook/...</code> gerada em cada workflow.</p>
        <p className="mt-1">IP externo: 163.176.45.217 · Porta n8n dedicada: 5679 · n8n legado: 5678 · Para produção exponha via HTTPS/reverse proxy e defina N8N_API_KEY + N8N_PUBLIC_URL.</p>
      </div>
    </>
  );
}
