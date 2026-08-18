import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Library, ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { wikiArticles } from "@/data/wiki";

export const Route = createFileRoute("/wiki/$slug")({
  loader: ({ params }) => {
    const index = wikiArticles.findIndex((a) => a.slug === params.slug);
    if (index === -1) throw notFound();
    return {
      article: wikiArticles[index]!,
      prev: index > 0 ? wikiArticles[index - 1]! : null,
      next: index < wikiArticles.length - 1 ? wikiArticles[index + 1]! : null,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Artigo indisponível — Wiki Grupo Geos" }, { name: "robots", content: "noindex" }] };
    }
    const { article } = loaderData;
    return {
      meta: [
        { title: `${article.title} — Wiki Grupo Geos` },
        { name: "description", content: article.summary },
        { property: "og:title", content: `${article.title} — Wiki Grupo Geos` },
        { property: "og:description", content: article.summary },
      ],
    };
  },
  component: WikiArticlePage,
});

function WikiArticlePage() {
  const { article, prev, next } = Route.useLoaderData();

  return (
    <>
      <Link
        to="/wiki"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Voltar para a Wiki
      </Link>
      <PageHeader icon={Library} title={article.title} subtitle={article.summary} />
      <p className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        {article.category} · Atualizado em {article.updatedAt}
        <StatusBadge tone="success">{article.version}</StatusBadge>
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <article className="space-y-4">
          {article.sections.map((s, i) => (
            <section
              key={s.heading}
              id={`secao-${i + 1}`}
              className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
            >
              <h2 className="text-sm font-semibold text-foreground">{s.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </article>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-6">
          <p className="text-xs font-semibold text-foreground">Sumário</p>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {article.sections.map((s, i) => (
              <li key={s.heading}>
                <a href={`#secao-${i + 1}`} className="hover:text-brand">
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <nav className="mt-8 flex flex-wrap justify-between gap-3">
        {prev ? (
          <Link
            to="/wiki/$slug"
            params={{ slug: prev.slug }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand"
          >
            <ArrowLeft className="size-3" /> {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to="/wiki/$slug"
            params={{ slug: next.slug }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand"
          >
            {next.title} <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </nav>
    </>
  );
}
