import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Library, Search } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { wikiArticles, wikiCategories } from "@/data/wiki";
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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");

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

      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((a) => (
          <li key={a.slug}>
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
