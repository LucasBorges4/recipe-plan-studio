import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Initials } from "@/components/portal/ProgressBar";
import { kanbanColumns, tasks as seedTasks } from "@/data/tasks";
import type { Priority, Task } from "@/data/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [items, setItems] = useState<Task[]>(seedTasks);
  const [columns, setColumns] = useState<string[]>([...kanbanColumns]);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("Todas");
  const [assignee, setAssignee] = useState("Todos");
  const [moduleFilter, setModuleFilter] = useState("Todos módulos");
  const [view, setView] = useState<"board" | "list">("board");
  const [detail, setDetail] = useState<Task | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

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
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, column } : t)));
  }

  function addTask() {
    const id = `t${Date.now()}`;
    setItems((prev) => [
      {
        id,
        title: "Nova tarefa",
        description: "Descreva o escopo desta tarefa.",
        column: columns[0] ?? "Backlog",
        priority: "Média",
        tags: [],
        assignee: "Não atribuída",
      },
      ...prev,
    ]);
    toast.success("Tarefa criada no Backlog.");
  }

  function addColumn() {
    const name = `Nova Coluna ${columns.length + 1}`;
    setColumns((prev) => [...prev, name]);
    toast.success(`Coluna "${name}" adicionada.`);
  }

  function TaskCard({ t }: { t: Task }) {
    return (
      <article
        draggable
        onDragStart={() => setDragging(t.id)}
        onDragEnd={() => setDragging(null)}
        onClick={() => setDetail(t)}
        className={cn(
          "cursor-pointer rounded-lg border border-border border-l-4 bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
          priorityBar[t.priority],
          dragging === t.id && "opacity-50",
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
          {t.comments ? (
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3" /> {t.comments}
            </span>
          ) : null}
        </div>
        {t.column === "Em Aprovação" ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(t.id, "Concluído");
                toast.success("Tarefa aprovada.");
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-success px-2 py-1.5 text-xs font-medium text-success-foreground"
            >
              <Check className="size-3" /> Aprovar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(t.id, "Em Progresso");
                toast("Tarefa devolvida para Em Progresso.");
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
            className={cn("px-2.5 py-2", view === "board" ? "bg-brand text-brand-foreground" : "bg-card")}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            aria-label="Visão em lista"
            onClick={() => setView("list")}
            className={cn("px-2.5 py-2", view === "list" ? "bg-brand text-brand-foreground" : "bg-card")}
          >
            <List className="size-4" />
          </button>
        </div>
        <button
          onClick={addColumn}
          className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          <Plus className="size-4" /> Nova Coluna
        </button>
        <button
          onClick={addTask}
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
        >
          <Plus className="size-4" /> Nova Tarefa
        </button>
      </div>

      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => t.column === col);
            return (
              <section
                key={col}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging) move(dragging, col);
                  setDragging(null);
                }}
                className="flex w-72 shrink-0 flex-col rounded-xl bg-card/60 p-3"
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
                      Nenhuma tarefa aqui
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
              onClick={() => setDetail(t)}
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

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>{detail?.description}</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3 text-sm">
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
                <p className="rounded-md bg-surface p-3 text-xs text-muted-foreground">
                  {detail.comments
                    ? `${detail.comments} comentário(s) registrados nesta tarefa.`
                    : "Nenhum comentário ainda."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {columns
                  .filter((c) => c !== detail.column)
                  .map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        move(detail.id, c);
                        setDetail({ ...detail, column: c });
                      }}
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
    </>
  );
}
