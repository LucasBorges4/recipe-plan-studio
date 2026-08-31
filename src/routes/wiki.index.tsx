import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Library, Search, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { can } from "@/lib/rbac";
import { usePortalData, useSession, qk } from "@/lib/api-hooks";
import { createWikiFn, deleteWikiFn } from "@/lib/portal-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wiki/")({
  head: () => ({
    meta: [
      { title: "Wiki — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Base de conhecimento técnica do Grupo Geos: arquitetura, padrões de código, DevOps e governança de dados.",
      },
      { property: "og:title", content: "Wiki — Grupo Geos" },
      {
        property: "og:description",
        content: "Documentação de padrões, processos e decisões técnicas do ERP.",
      },
    ],
  }),
  component: WikiIndex,
});

function WikiIndex() {
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const { data: session } = useSession();
  const wikiArticles = state?.wiki ?? [];
  const wikiCategories = Array.from(new Set(wikiArticles.map((a) => a.category)));
  const mayWrite = !!session?.user && can(session.user.role, "wiki.write");
  const mayDelete = !!session?.user && can(session.user.role, "wiki.delete");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");

  const createM = useMutation({
    mutationFn: (v: { slug: string; title: string }) =>
      createWikiFn({
        data: {
          slug: v.slug,
          title: v.title,
          category: "Geral",
          summary: "Artigo criado via portal.",
          version: "v1",
          sections: [{ heading: "Introdução", body: "Conteúdo inicial." }],
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Artigo criado.");
      setSlug("");
      setTitle("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar artigo."),
  });
  const delM = useMutation({
    mutationFn: (v: { slug: string }) => deleteWikiFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Artigo removido.");
    },
  });

  const list = wikiArticles.filter(
    (a) =>
      (category === "Todas" || a.category === category) &&
      (a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.summary.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        icon={Library}
        title="Wiki"
        subtitle="Base de conhecimento técnica e de processos"
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar artigos..."
            className="w-full rounded-md border border-input bg-card py-2 pr-3 pl-9 text-sm"
          />
        </div>
        {["Todas", ...wikiCategories].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              category === c
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {mayWrite ? (
        <div className="mb-4 flex gap-2">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug (ex: novo-artigo)"
            className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs"
          />
          <button
            disabled={!slug.trim() || !title.trim() || createM.isPending}
            onClick={() => createM.mutate({ slug: slug.trim().toLowerCase(), title: title.trim() })}
            className="flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
          >
            <Plus className="size-3" /> Novo
          </button>
        </div>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((a) => (
          <li key={a.slug} className="relative">
            <Link
              to="/wiki/$slug"
              params={{ slug: a.slug }}
              className="block h-full rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">{a.title}</h2>
                <StatusBadge tone="brand">{a.category}</StatusBadge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{a.summary}</p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Atualizado em {a.updatedAt} · {a.version}
              </p>
            </Link>
            {mayDelete ? (
              <button
                aria-label="Remover artigo"
                onClick={() => delM.mutate({ slug: a.slug })}
                className="absolute top-2 right-2 rounded-md bg-card p-1 text-muted-foreground hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
        {list.length === 0 ? (
          <li className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum artigo encontrado.
          </li>
        ) : null}
      </ul>
    </>
  );
}
