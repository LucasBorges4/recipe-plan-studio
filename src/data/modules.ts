import type { Module } from "./types";

export const modules: Module[] = [
  {
    id: "crm",
    name: "CRM",
    status: "Aguardando início",
    tone: "neutral",
    date: "01/09/2026",
    done: 0,
    total: 8,
  },
  {
    id: "fiscal",
    name: "Fiscal e Tributário",
    status: "Em Andamento",
    tone: "info",
    date: "12/02/2026",
    done: 5,
    total: 9,
  },
  {
    id: "financeiro",
    name: "Financeiro",
    status: "Em Andamento",
    tone: "info",
    date: "20/02/2026",
    done: 6,
    total: 9,
  },
  {
    id: "faturamento",
    name: "Faturamento e Vendas",
    status: "Aguardando início",
    tone: "neutral",
    date: "15/03/2026",
    done: 0,
    total: 7,
  },
  {
    id: "compras",
    name: "Compras e Suprimentos",
    status: "Aguardando início",
    tone: "neutral",
    date: "01/04/2026",
    done: 0,
    total: 6,
  },
  {
    id: "estoque",
    name: "Estoque",
    status: "Aguardando início",
    tone: "neutral",
    date: "20/04/2026",
    done: 0,
    total: 6,
  },
  {
    id: "ged",
    name: "Gestão Eletrônica de Documentos",
    status: "Em levantamento",
    tone: "warning",
    date: "05/05/2026",
    done: 1,
    total: 5,
  },
];

export const nextSteps = [
  {
    title: "Fechar homologação do módulo Fiscal",
    detail: "Validação das notas de entrada e CT-e com o time tributário.",
    due: "28/02/2026",
  },
  {
    title: "Kick-off do módulo Faturamento",
    detail: "Alinhamento de escopo com a área comercial e definição de squad.",
    due: "10/03/2026",
  },
  {
    title: "Revisão de segurança e LGPD",
    detail: "Auditoria de acessos e revisão dos controles de dados pessoais.",
    due: "18/03/2026",
  },
];
