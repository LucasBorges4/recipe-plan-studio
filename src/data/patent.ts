import type { PatentStage } from "./types";

export const patentStages: PatentStage[] = [
  {
    id: "p1",
    title: "Busca de Anterioridade",
    description:
      "Pesquisa em bases de patentes nacionais e internacionais para verificar a novidade da invenção.",
    owner: "Rafael Mendes",
    deadline: "15 Jan 2026",
    status: "Concluído",
  },
  {
    id: "p2",
    title: "Redação do Pedido",
    description:
      "Elaboração do relatório descritivo, reivindicações, resumo e desenhos técnicos do software.",
    owner: "Ana Beatriz Silva",
    deadline: "15 Fev 2026",
    status: "Concluído",
  },
  {
    id: "p3",
    title: "Depósito no INPI",
    description: "Protocolo do pedido de patente junto ao Instituto Nacional da Propriedade Industrial.",
    owner: "Rafael Mendes",
    deadline: "01 Mar 2026",
    status: "Em Andamento",
  },
  {
    id: "p4",
    title: "Exame Formal",
    description: "Análise formal pelo INPI para verificar documentação e requisitos administrativos.",
    owner: "INPI",
    deadline: "01 Jun 2026",
    status: "Pendente",
  },
  {
    id: "p5",
    title: "Publicação na RPI",
    description:
      "Publicação do pedido na Revista da Propriedade Industrial após 18 meses do depósito.",
    owner: "INPI",
    deadline: "01 Set 2027",
    status: "Pendente",
  },
  {
    id: "p6",
    title: "Exame Técnico",
    description: "Análise técnica de patenteabilidade: novidade, atividade inventiva e aplicação industrial.",
    owner: "INPI",
    deadline: "A definir",
    status: "Aguardando",
  },
  {
    id: "p7",
    title: "Concessão da Carta Patente",
    description: "Emissão da carta patente pelo INPI após aprovação no exame técnico.",
    owner: "INPI",
    deadline: "A definir",
    status: "Aguardando",
  },
];
