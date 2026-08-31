import { createFileRoute } from "@tanstack/react-router";
import { LegalDocPage } from "@/components/portal/LegalDocPage";
import { usePortalData } from "@/lib/api-hooks";
import { formatBR } from "@/lib/doc-schemas";

export const Route = createFileRoute("/lgpd")({
  head: () => ({
    meta: [
      { title: "Política LGPD — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Como o Grupo Geos trata dados pessoais no Portal de Governança, conforme a Lei 13.709/2018.",
      },
      { property: "og:title", content: "Política LGPD — Grupo Geos" },
      {
        property: "og:description",
        content: "Finalidades, bases legais, retenção e direitos do titular de dados.",
      },
    ],
  }),
  component: LgpdPage,
});

function LgpdPage() {
  const { data: state, isLoading } = usePortalData();
  const doc = state?.legalDocs?.find((d) => d.slug === "lgpd");
  if (isLoading) return <div className="animate-pulse rounded-xl border border-border bg-card p-6 h-64" />;
  if (!doc) return <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Documento não encontrado. Crie em Administração.</p>;
  return <LegalDocPage doc={{ title: doc.title, subtitle: doc.subtitle, updatedAt: formatBR(doc.publishedAt), version: doc.version, intro: doc.intro, clauses: doc.clauses }} />;
}
