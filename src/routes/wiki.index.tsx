import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Library, Search, Plus, X, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { usePortalData, useSession, qk } from "@/lib/api-hooks";
import { userCan } from "@/lib/rbac";
import { createWikiFn, deleteWikiFn } from "@/lib/portal-api";
import { WikiHero } from "@/components/portal/wiki/WikiHero";
import { CategoryCard } from "@/components/portal/wiki/CategoryCard";
import { RecentArticlesTable } from "@/components/portal/wiki/RecentArticlesTable";
import { WikiSidebar } from "@/components/portal/wiki/WikiSidebar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wiki/")({
  head: () => ({
    meta: [
      { title: "Wiki — Portal de Governança GWG — Grupo W. Geotec" },
      {
        name: "description",
        content:
          "Base de conhecimento do projeto GWG: guias de uso, processos, controles de conformidade, integrações e treinamentos.",
      },
      { property: "og:title", content: "Wiki — GWG — Grupo W. Geotec" },
      {
        property: "og:description",
        content: "Documentação de padrões, processos e decisões do projeto.",
      },
    ],
  }),
  component: WikiIndex,
});

function WikiIndex() {
  const qc = useQueryClient();
  const { data: state, isLoading, isError, refetch } = usePortalData();
  const { data: session } = useSession();
  const wikiArticles = state?.wiki ?? [];
  const role = session?.user?.role;
  const mayWrite = role === "admin" || role === "gestor";
  const mayDelete = !!session?.user && userCan(session.user, "wiki.delete");

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of wikiArticles) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    return Array.from(counts.entries());
  }, [wikiArticles]);

  const sorted = useMemo(
    () => [...wikiArticles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [wikiArticles],
  );
  const featured = sorted.slice(0, 3);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((a) => {
      if (activeCategory && a.category !== activeCategory) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    });
  }, [sorted, query, activeCategory]);

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
      setCreating(false);
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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover artigo."),
  });

  return (
    <>
      <PageHeader
        icon={Library}
        title="Wiki"
        subtitle="Base de conhecimento do projeto. Tudo o que você precisa saber, em um só lugar."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no Wiki..."
            className="w-full rounded-md border border-input bg-card py-2 pr-3 pl-9 text-sm"
          />
        </div>
        {["Todos", ...categories.map(([c]) => c)].map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c === "Todos" ? null : c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              (c === "Todos" ? activeCategory === null : activeCategory === c)
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
        {mayWrite ? (
          <button
            onClick={() => setCreating((v) => !v)}
            className="ml-auto flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:bg-brand/90"
          >
            {creating ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {creating ? "Cancelar" : "Novo artigo"}
          </button>
        ) : null}
      </div>

      {creating && mayWrite ? (
        <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug (ex: novo-artigo)"
            className="min-w-40 flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do artigo"
            className="min-w-40 flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs"
          />
          <button
            disabled={!slug.trim() || !title.trim() || createM.isPending}
            onClick={() => createM.mutate({ slug: slug.trim().toLowerCase(), title: title.trim() })}
            className="flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
          >
            <Plus className="size-3" /> Criar
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <WikiHero />

        <section>
          <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-foreground">
            Categorias
            <button
              onClick={() => setActiveCategory(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-brand"
            >
              Ver todas <ArrowRight className="size-3" />
            </button>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {categories.map(([c, count]) => (
              <CategoryCard
                key={c}
                category={c}
                count={count}
                active={activeCategory === c}
                onClick={() => setActiveCategory(activeCategory === c ? null : c)}
              />
            ))}
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma categoria cadastrada ainda.
              </p>
            ) : null}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="size-4 text-brand" /> Artigos recentes
              {activeCategory ? <span className="text-muted-foreground">· {activeCategory}</span> : null}
            </h2>

            {isLoading ? (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0">
                    <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                    <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
                    <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Não foi possível carregar a base de conhecimento.
                </p>
                <button
                  onClick={() => refetch()}
                  className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium"
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <RecentArticlesTable
                articles={filtered}
                mayDelete={mayDelete}
                onDelete={(s) => delM.mutate({ slug: s })}
              />
            )}
          </div>

          <WikiSidebar featured={featured} />
        </div>
      </div>
    </>
  );
}