import type { Milestone, Release } from "./types";

export const milestones: Milestone[] = [
  {
    id: "m1",
    date: "12 Fev 2026",
    type: "Entrega",
    title: "Módulo Financeiro entregue",
    description:
      "Contas a pagar, contas a receber, conciliação bancária e DRE gerencial foram liberados em produção.",
  },
  {
    id: "m2",
    date: "28 Jan 2026",
    type: "Integração",
    title: "Integração com SEFAZ concluída",
    description:
      "Emissão de NF-e, NFS-e e CT-e agora funciona de ponta a ponta com validação automática.",
  },
  {
    id: "m3",
    date: "15 Jan 2026",
    type: "Marco",
    title: "Kick-off da Fase 3",
    description:
      "Início do desenvolvimento dos módulos de RH, Folha e eSocial com a equipe ampliada.",
  },
  {
    id: "m4",
    date: "20 Dez 2025",
    type: "Decisão",
    title: "Aprovação do comitê de arquitetura",
    description:
      "Arquitetura de microsserviços validada por consultoria externa. Padrão event-driven confirmado.",
  },
  {
    id: "m5",
    date: "05 Dez 2025",
    type: "Marco",
    title: "MVP apresentado aos sócios",
    description:
      "Primeira demonstração do ERP com módulos de cadastro, vendas e estoque. Feedback muito positivo.",
  },
];

export const releases: Release[] = [
  {
    version: "v2.4.0",
    date: "10 Fev 2026",
    items: ["Novo relatório de fluxo de caixa projetado", "Fix no cálculo de ICMS-ST"],
  },
  {
    version: "v2.3.1",
    date: "02 Fev 2026",
    items: ["Correção de performance na tela de conciliação", "Melhoria no filtro de períodos"],
  },
  {
    version: "v2.3.0",
    date: "15 Jan 2026",
    items: ["Integração fiscal completa", "Novo dashboard de impostos", "Suporte a CT-e"],
  },
];
