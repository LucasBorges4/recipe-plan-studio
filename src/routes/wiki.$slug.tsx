import { createFileRoute, Link } from "@tanstack/react-router";
import { Library, ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import {
  RecordDialog,
  DeleteRecordButton,
  useCanManageRecords,
} from "@/components/portal/RecordForm";
import { wikiFields } from "@/routes/wiki.index";
import { readDocs } from "@/lib/doc-schemas";
import { usePortalData } from "@/lib/api-hooks";

export const Route = createFileRoute("/wiki/$slug")({
  head: () => ({
    meta: [
      { title: "Artigo — Wiki Grupo Geos" },
      {
        name: "description",
        content: "Artigo da base de conhecimento técnica do Portal de Governança Grupo Geos.",
      },
      { property: "og:title", content: "Artigo — Wiki Grupo Geos" },
      {
        property: "og:description",
        content: "Documentação técnica e de processos do ERP do Grupo Geos.",
      },
    ],
  }),
  component: WikiArticlePage,
});

function WikiArticlePage() {
  const { slug } = Route.useParams();
  const { data: portal, isLoading } = usePortalData();
  const canManage = useCanManageRecords();

  const articles = readDocs(portal?.docs, "wiki");
  const index = articles.findIndex((a) => a.data.slug === slug);
  const article = index >= 0 ? articles[index]! : null;
  const prev = index > 0 ? articles[index - 1]! : null;
  const next = index >= 0 && index < articles.length - 1 ? articles[index + 1]! : null;

  if (!article) {
    return (
      <>
        <Link
          to="/wiki"
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Voltar para a Wiki
        </Link>
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {isLoading ? "Carregando artigo..." : "Artigo não encontrado nesta base de conhecimento."}
        </p>
      </>
    );
  }

  return (
    <>
      <Link
        to="/wiki"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Voltar para a Wiki
      </Link>
      <PageHeader icon={Library} title={article.data.title} subtitle={article.data.summary} />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {article.data.category} · Atualizado em{" "}
        {new Date(article.updatedAt).toLocaleDateString("pt-BR")}
        <StatusBadge tone="success">{article.data.version}</StatusBadge>
        {canManage ? (
          <span className="ml-auto flex items-center">
            <RecordDialog
              kind="wiki"
              fields={wikiFields}
              id={article.id}
              initial={article.data}
              variant="icon"
            />
            <DeleteRecordButton id={article.id} label={article.data.title} />
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <article className="space-y-4">
          {article.data.sections.map((s, i) => (
            <section
              key={`${s.heading}-${i}`}
              id={`secao-${i + 1}`}
              className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
            >
              <h2 className="text-sm font-semibold text-foreground">{s.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {s.body}
              </p>
            </section>
          ))}
        </article>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-6">
          <p className="text-xs font-semibold text-foreground">Sumário</p>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {article.data.sections.map((s, i) => (
              <li key={`${s.heading}-${i}`}>
                <a href={`#secao-${i + 1}`} className="hover:text-brand">
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <nav className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs">
        {prev ? (
          <Link
            to="/wiki/$slug"
            params={{ slug: prev.data.slug }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-brand"
          >
            <ArrowLeft className="size-3" /> {prev.data.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to="/wiki/$slug"
            params={{ slug: next.data.slug }}
            className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-brand"
          >
            {next.data.title} <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </nav>
    </>
  );
}
