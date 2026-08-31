import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KanbanSquare,
  Search,
  Plus,
  LayoutGrid,
  List,
  Check,
  X,
  Clock,
  MessageSquare,
  Inbox,
  MoreVertical,
  History,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Initials } from "@/components/portal/ProgressBar";
import type { Priority, Task } from "@/data/types";
import { cn } from "@/lib/utils";
import { can } from "@/lib/rbac";
import { formatDateTime } from "@/lib/portal-utils";
import { usePortalData, useSession, useTaskHistory, qk } from "@/lib/api-hooks";
import { moveTaskFn, createTaskFn, addColumnFn, addCommentFn } from "@/lib/portal-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Kanban de tarefas do projeto ERP: backlog, execução, aprovações e entregas concluídas.",
      },
      { property: "og:title", content: "Tarefas — Grupo Geos" },
      {
        property: "og:description",
        content: "Board de tarefas com filtros por módulo, prioridade e responsável.",
      },
    ],
  }),
  component: TarefasPage,
});

const priorityBar: Record<Priority, string> = {
  Alta: "border-l-danger",
  Média: "border-l-warning",
  Baixa: "border-l-info",
};

const priorityTone = { Alta: "danger", Média: "warning", Baixa: "info" } as const;

function TarefasPage() {
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const { data: session } = useSession();

  const items = state?.tasks ?? [];
  const columns = state?.columns ?? [];
  const comments = state?.comments ?? [];

  const user = session?.user ?? null;
  const may = (p: Parameters<typeof can>[1]) => !!user && can(user.role, p);

  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("Todas");
  const [assignee, setAssignee] = useState("Todos");
  const [moduleFilter, setModuleFilter] = useState("Todos módulos");
  const [view, setView] = useState<"board" | "list">("board");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("Média");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDue, setNewDue] = useState("");

  const detail = items.find((t) => t.id === detailId) ?? null;
  const { data: historyRes } = useTaskHistory(detailId);
  const detailHistory = historyRes?.ok ? historyRes.data : [];

  const moveM = useMutation({
    mutationFn: (v: { taskId: string; column: string }) => moveTaskFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao mover a tarefa."),
  });
  const createM = useMutation({
    mutationFn: (v: { title: string; priority: Priority; assignee: string; due?: string }) =>
      createTaskFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Tarefa criada no Backlog e registrada na auditoria.");
      setCreating(false);
      setNewTitle("");
      setNewAssignee("");
      setNewDue("");
      setNewPriority("Média");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar a tarefa."),
  });
  const columnM = useMutation({
    mutationFn: (v: { name: string }) => addColumnFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar a coluna."),
  });
  const commentM = useMutation({
    mutationFn: (v: { taskId: string; body: string }) => addCommentFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao comentar."),
  });

  const assignees = useMemo(
    () => ["Todos", ...Array.from(new Set(items.map((t) => t.assignee)))],
    [items],
  );
  const modulesList = useMemo(
    () => ["Todos módulos", ...Array.from(new Set(items.flatMap((t) => t.tags)))],
    [items],
  );

  const filtered = items.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) &&
      (priority === "Todas" || t.priority === priority) &&
      (assignee === "Todos" || t.assignee === assignee) &&
      (moduleFilter === "Todos módulos" || t.tags.includes(moduleFilter)),
  );

  function move(id: string, column: string) {
    const task = items.find((t) => t.id === id);
    if (!task) return;
    const approving = column === "Concluído" && task.column === "Em Aprovação";
    if (approving && !may("task.approve")) {
      toast.error("Seu papel não tem permissão para aprovar tarefas.");
      return;
    }
    if (!approving && !may("task.move")) {
      toast.error("Seu papel não tem permissão para mover tarefas.");
      return;
    }
    moveM.mutate({ taskId: id, column });
  }

  function handleAddColumn() {
    if (!may("task.create")) {
      toast.error("Somente gestor ou administrador pode alterar o board.");
      return;
    }
    columnM.mutate({ name: `Nova Coluna ${columns.length + 1}` });
  }

  function submitComment() {
    if (!detail || !commentDraft.trim()) return;
    if (!may("task.comment")) {
      toast.error("Seu papel não permite comentar.");
      return;
    }
    commentM.mutate({ taskId: detail.id, body: commentDraft.trim() });
    setCommentDraft("");
  }

  function TaskCard({ t }: { t: Task }) {
    const count = comments.filter((c) => c.taskId === t.id).length + (t.comments ?? 0);
    return (
      <article
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", t.id);
          setDragging(t.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setDragOverCol(null);
        }}
        onClick={() => setDetailId(t.id)}
        className={cn(
          "cursor-grab rounded-lg border border-border border-l-4 bg-card p-3 shadow-sm transition-all select-none hover:shadow-md active:cursor-grabbing",
          priorityBar[t.priority],
          dragging === t.id && "rotate-1 scale-[0.98] opacity-60 shadow-lg",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">{t.title}</h3>
          <StatusBadge tone={priorityTone[t.priority]}>{t.priority}</StatusBadge>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {t.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-neutral-soft px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Initials name={t.assignee} /> {t.assignee}
          </span>
          {t.due ? (
            <span className="flex items-center gap-1 text-danger">
              <Clock className="size-3" /> {t.due}
            </span>
          ) : null}
          {count ? (
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3" /> {count}
            </span>
          ) : null}
        </div>
        {t.column === "Em Aprovação" ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(t.id, "Concluído");
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-success px-2 py-1.5 text-xs font-medium text-success-foreground"
            >
              <Check className="size-3" /> Aprovar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(t.id, "Em Progresso");
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-danger px-2 py-1.5 text-xs font-medium text-danger-foreground"
            >
              <X className="size-3" /> Rejeitar
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  const detailComments = detail ? comments.filter((c) => c.taskId === detail.id) : [];

  return (
    <>
      <PageHeader
        icon={KanbanSquare}
        title="Tarefas"
        subtitle="Board de execução e aprovação das entregas do ERP"
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full rounded-md border border-input bg-card py-2 pr-3 pl-9 text-sm text-foreground"
          />
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Prioridade"
          className="rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          {["Todas", "Alta", "Média", "Baixa"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          aria-label="Responsável"
          className="rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          {assignees.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          aria-label="Módulo"
          className="rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          {modulesList.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-md border border-input">
          <button
            aria-label="Visão em board"
            onClick={() => setView("board")}
            className={cn(
              "px-2.5 py-2",
              view === "board" ? "bg-brand text-brand-foreground" : "bg-card",
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            aria-label="Visão em lista"
            onClick={() => setView("list")}
            className={cn(
              "px-2.5 py-2",
              view === "list" ? "bg-brand text-brand-foreground" : "bg-card",
            )}
          >
            <List className="size-4" />
          </button>
        </div>
        <button
          onClick={handleAddColumn}
          className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          <Plus className="size-4" /> Nova Coluna
        </button>
        <button
          onClick={() => {
            if (!may("task.create")) {
              toast.error("Somente gestor ou administrador pode criar tarefas.");
              return;
            }
            setCreating(true);
          }}
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
        >
          <Plus className="size-4" /> Nova Tarefa
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 py-12 text-center">
          <Inbox className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Nenhuma tarefa cadastrada ainda</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Crie a primeira tarefa em "Nova Tarefa". Depois arraste o cartão entre as colunas para
            registrar o andamento.
          </p>
        </div>
      ) : null}

      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => t.column === col);
            return (
              <section
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverCol !== col) setDragOverCol(col);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragOverCol((c) => (c === col ? null : c));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragging;
                  const task = id ? items.find((t) => t.id === id) : null;
                  if (id && task && task.column !== col) move(id, col);
                  setDragging(null);
                  setDragOverCol(null);
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-xl border-2 border-transparent bg-card/60 p-3 transition-colors",
                  dragOverCol === col && dragging
                    ? "border-brand border-dashed bg-brand-soft/40"
                    : "",
                )}
              >
                <header className="mb-3 flex items-center justify-between border-t-2 border-brand pt-2">
                  <span className="text-sm font-semibold text-foreground">{col}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {colTasks.length}
                    <MoreVertical className="size-3.5" />
                  </span>
                </header>
                <div className="flex flex-1 flex-col gap-3">
                  {colTasks.map((t) => (
                    <TaskCard key={t.id} t={t} />
                  ))}
                  {colTasks.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-xs text-muted-foreground">
                      <Inbox className="size-5" />
                      {dragging ? "Solte aqui para mover" : "Arraste uma tarefa para cá"}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li
              key={t.id}
              onClick={() => setDetailId(t.id)}
              className={cn(
                "cursor-pointer rounded-lg border border-border border-l-4 bg-card p-4",
                priorityBar[t.priority],
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{t.title}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge tone="neutral">{t.column}</StatusBadge>
                  <StatusBadge tone={priorityTone[t.priority]}>{t.priority}</StatusBadge>
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>{detail?.description}</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Coluna: <span className="text-foreground">{detail.column}</span> · Prioridade:{" "}
                <span className="text-foreground">{detail.priority}</span>
              </p>
              <p className="text-muted-foreground">
                Responsável: <span className="text-foreground">{detail.assignee}</span>
                {detail.due ? ` · Prazo: ${detail.due}` : ""}
              </p>

              <div>
                <p className="mb-2 text-xs font-semibold text-foreground">Comentários</p>
                <ul className="space-y-2">
                  {detailComments.map((c) => (
                    <li key={c.id} className="rounded-md bg-surface p-3 text-xs">
                      <p className="text-foreground">{c.body}</p>
                      <p className="mt-1 text-muted-foreground">
                        {c.authorName} · {formatDateTime(c.at)}
                      </p>
                    </li>
                  ))}
                  {detailComments.length === 0 ? (
                    <li className="rounded-md bg-surface p-3 text-xs text-muted-foreground">
                      Nenhum comentário ainda.
                    </li>
                  ) : null}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitComment()}
                    placeholder={`Comentar como ${user?.name ?? "convidado"}...`}
                    className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground"
                  />
                  <button
                    onClick={submitComment}
                    className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground"
                  >
                    Enviar
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <History className="size-3.5 text-brand" /> Histórico da tarefa
                </p>
                <ul className="space-y-2">
                  {detailHistory.map((h) => (
                    <li key={h.id} className="rounded-md border border-border p-3 text-xs">
                      <p className="text-foreground">{h.action}</p>
                      <p className="mt-1 text-muted-foreground">
                        {h.actor} · {formatDateTime(h.at)}
                        {h.before && h.after ? ` · ${h.before} → ${h.after}` : ""}
                      </p>
                    </li>
                  ))}
                  {detailHistory.length === 0 ? (
                    <li className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                      Sem movimentações registradas.
                    </li>
                  ) : null}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                {columns
                  .filter((c) => c !== detail.column)
                  .map((c) => (
                    <button
                      key={c}
                      onClick={() => move(detail.id, c)}
                      className="rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Mover para {c}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
            <DialogDescription>
              Cria uma tarefa no Backlog e registra na auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Título</Label>
              <Input
                id="task-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex.: Integrar módulo de notas fiscais"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-priority">Prioridade</Label>
                <select
                  id="task-priority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as Priority)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  {(["Alta", "Média", "Baixa"] as Priority[]).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Prazo (opcional)</Label>
                <Input
                  id="task-due"
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">Responsável</Label>
              <Input
                id="task-assignee"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                placeholder={user?.name ?? "Nome do responsável"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!newTitle.trim() || createM.isPending}
              onClick={() =>
                createM.mutate({
                  title: newTitle.trim(),
                  priority: newPriority,
                  assignee: newAssignee.trim() || user?.name || "",
                  ...(newDue.trim() ? { due: newDue.trim() } : {}),
                })
              }
            >
              {createM.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
