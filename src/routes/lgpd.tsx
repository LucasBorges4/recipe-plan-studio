import { createFileRoute } from "@tanstack/react-router";
import { LegalDocPage } from "@/components/portal/LegalDocPage";
import { lgpdDoc } from "@/data/legal";

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
  component: () => <LegalDocPage doc={lgpdDoc} />,
});
