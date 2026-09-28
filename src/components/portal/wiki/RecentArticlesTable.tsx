import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal, ExternalLink, Link2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/portal/Avatar";
import { StatusBadge } from "@/components/portal/StatusBadge";
import type { WikiArticle, StatusTone } from "@/data/types";
import { cn } from "@/lib/utils";

const helper = createColumnHelper<WikiArticle>();

const CATEGORY_TONE: Record<string, StatusTone> = {
  "Sobre o Projeto": "brand",
  "Como usar o sistema": "info",
  "Processos da GWG": "warning",
  Compliance: "success",
  "Integracoes e Automacoes": "brand",
  "Documentos e Referencias": "neutral",
  "Perguntas Frequentes": "info",
  Treinamentos: "success",
};

function fmtDate(s: string) {
  const parts = (s ?? "").slice(0, 10).split("-");
  if (parts.length !== 3) return s;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function RecentArticlesTable({
  articles,
  mayDelete,
  onDelete,
}: {
  articles: WikiArticle[];
  mayDelete: boolean;
  onDelete?: (slug: string) => void;
}) {
  const [menuSlug, setMenuSlug] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      [
      helper.accessor("title", {
        header: "Título",
        cell: (info) => {
          const a = info.row.original;
          return (
            <Link
              to="/wiki/$slug"
              params={{ slug: a.slug }}
              className="line-clamp-1 font-medium text-foreground hover:text-brand hover:underline"
            >
              {a.title}
            </Link>
          );
        },
      }),
      helper.accessor("category", {
        header: "Categoria",
        cell: (info) => {
          const cat = info.getValue() ?? "";
          return <StatusBadge tone={CATEGORY_TONE[cat] ?? "neutral"}>{cat}</StatusBadge>;
        },
      }),
      helper.accessor("updatedBy", {
        header: "Atualizado por",
        cell: (info) => {
          const name = info.getValue() || "—";
          return (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Avatar name={name} size="xs" />
              <span className="text-xs whitespace-nowrap">{name}</span>
            </span>
          );
        },
      }),
      helper.accessor("updatedAt", {
        header: "Data",
        cell: (info) => (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {fmtDate(info.getValue())}
          </span>
        ),
      }),
      helper.display({
        id: "menu",
        header: "",
        cell: (info) => {
          const a = info.row.original;
          const open = menuSlug === a.slug;
          return (
            <div className="relative flex justify-end">
              <button
                aria-label="Menu do artigo"
                onClick={() => setMenuSlug(open ? null : a.slug)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {open ? (
                <div className="absolute top-9 right-0 z-20 flex w-44 flex-col gap-0.5 rounded-lg border border-border bg-card p-1 shadow-lg">
                  <Link
                    to="/wiki/$slug"
                    params={{ slug: a.slug }}
                    onClick={() => setMenuSlug(null)}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted"
                  >
                    <ExternalLink className="size-3.5 text-muted-foreground" /> Abrir artigo
                  </Link>
                  <button
                    onClick={() => {
                      if (typeof navigator !== "undefined") {
                        navigator.clipboard?.writeText(window.location.origin + "/wiki/" + a.slug);
                      }
                      setMenuSlug(null);
                    }}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted"
                  >
                    <Link2 className="size-3.5 text-muted-foreground" /> Copiar link
                  </button>
                  {mayDelete && onDelete ? (
                    <button
                      onClick={() => {
                        setMenuSlug(null);
                        onDelete(a.slug);
                      }}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="size-3.5" /> Remover
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        },
      }),
    ],
    [menuSlug, mayDelete, onDelete],
  );

  const table = useReactTable({
    data: articles,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs tracking-wide text-muted-foreground">
              {table.getLeafHeaders().map((header) => (
                <th key={header.id} className="px-4 py-3 font-medium">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum artigo encontrado.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40",
                    menuSlug === row.original.slug && "bg-muted/40",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn("px-4 py-3", cell.column.id === "title" && "max-w-72")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}