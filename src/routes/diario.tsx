import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Tag, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import type { StatusTone } from "@/data/types";
import { can } from "@/lib/rbac";
import { usePortalData, useSession, qk } from "@/lib/api-hooks";
import { createMilestoneFn, deleteMilestoneFn, deleteReleaseFn } from "@/lib/portal-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/diario")({
  head: () => ({
    meta: [
      { title: "Diário de Bordo — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content: "Marcos, entregas e evolução do projeto ERP do Grupo Geos, com release notes.",
      },
      { property: "og:title", content: "Diário de Bordo — Grupo Geos" },
      {
        property: "og:description",
        content: "Histórico de marcos, integrações e decisões do projeto.",
      },
    ],
  }),
  component: DiarioPage,
});

const typeTone: Record<string, StatusTone> = {
  Entrega: "success",
  Integração: "info",
  Marco: "brand",
  Decisão: "warning",
};

const filters = ["Todos", "Entrega", "Integração", "Marco", "Decisão"] as const;

function DiarioPage() {
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const { data: session } = useSession();
  const milestones = state?.milestones ?? [];
  const releases = state?.releases ?? [];
  const mayManage = !!session?.user && can(session.user.role, "journal.manage");
  const isEmptyMilestones = milestones.length === 0;
  const isEmptyReleases = releases.length === 0;
  const [filter, setFilter] = useState<(typeof filters)[number]>("Todos");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const list = milestones.filter((m) => filter === "Todos" || m.type === filter);

  const addM = useMutation({
    mutationFn: (v: { title: string; description: string }) =>
      createMilestoneFn({
        data: {
          date: new Date().toLocaleDateString("pt-BR"),
          type: "Marco",
          title: v.title,
          description: v.description,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Marco registrado.");
      setNewTitle("");
      setNewDesc("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar marco."),
  });
  const delM = useMutation({
    mutationFn: (v: { id: string }) => deleteMilestoneFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Marco removido.");
    },
  });
  const delR = useMutation({
    mutationFn: (v: { version: string }) => deleteReleaseFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
  });

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Diário de Bordo"
        subtitle="Marcos, entregas e evolução do projeto"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {mayManage ? (
        <div className="mb-4 flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Novo marco: título"
            className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Descrição"
            className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs"
          />
          <button
            disabled={!newTitle.trim() || !newDesc.trim() || addM.isPending}
            onClick={() => addM.mutate({ title: newTitle.trim(), description: newDesc.trim() })}
            className="flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
          >
            <Plus className="size-3" /> Adicionar
          </button>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ol className="relative rounded-xl border border-border bg-card p-6">
          {list.map((m, i) => (
            <li key={m.id} className="relative flex gap-4 pb-8 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Tag className="size-3.5" />
                </span>
                {i < list.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{m.date}</span>
                  <StatusBadge tone={typeTone[m.type] ?? "neutral"}>{m.type}</StatusBadge>
                  {mayManage ? (
                    <button
                      onClick={() => delM.mutate({ id: m.id })}
                      className="ml-auto text-muted-foreground hover:text-danger"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  ) : null}
                </div>
                <h2 className="mt-1 text-base font-semibold text-foreground">{m.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              </div>
            </li>
          ))}
          {list.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">
              {isEmptyMilestones
                ? "Plataforma limpa — nenhum marco cadastrado. Gestor/admin cria o primeiro."
                : "Nenhum evento neste filtro."}
            </li>
          ) : null}
        </ol>

        <aside className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Release Notes</h2>
          {isEmptyReleases ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Plataforma limpa — nenhuma release cadastrada.
            </p>
          ) : null}
          <ul className="mt-4 space-y-4">
            {releases.map((r) => (
              <li key={r.version} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-brand">{r.version}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{r.date}</span>
                    {mayManage ? (
                      <button
                        onClick={() => delR.mutate({ version: r.version })}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : null}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {r.items.map((it) => (
                    <li key={it}>• {it}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
