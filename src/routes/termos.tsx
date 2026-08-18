import { createFileRoute } from "@tanstack/react-router";
import { LegalDocPage } from "@/components/portal/LegalDocPage";
import { termsDoc } from "@/data/legal";

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
  component: () => <LegalDocPage doc={termsDoc} />,
});
