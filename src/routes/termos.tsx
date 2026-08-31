import { createFileRoute } from "@tanstack/react-router";
import { LegalDocPage } from "@/components/portal/LegalDocPage";
import { usePortalData } from "@/lib/api-hooks";
import { formatBR } from "@/lib/doc-schemas";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Termos e condições gerais de uso do Portal de Governança Corporativa do Grupo Geos.",
      },
      { property: "og:title", content: "Termos de Uso — Grupo Geos" },
      {
        property: "og:description",
        content: "Regras de acesso, uso aceitável e propriedade intelectual do Portal.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  const { data: state, isLoading } = usePortalData();
  const doc = state?.legalDocs?.find((d) => d.slug === "termos");
  if (isLoading) return <div className="animate-pulse rounded-xl border border-border bg-card p-6 h-64" />;
  if (!doc) return <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Documento não encontrado. Crie em Administração.</p>;
  return <LegalDocPage doc={{ title: doc.title, subtitle: doc.subtitle, updatedAt: formatBR(doc.publishedAt), version: doc.version, intro: doc.intro, clauses: doc.clauses }} />;
}
