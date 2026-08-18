import type { Risk } from "./types";

export const risks: Risk[] = [
  {
    id: "r1",
    title: "Atraso na homologação fiscal com a SEFAZ",
    category: "Prazo",
    owner: "Ana Beatriz Silva",
    probability: 4,
    impact: 5,
    mitigation: "Ambiente de homologação dedicado e testes semanais com o contador responsável.",
  },
  {
    id: "r2",
    title: "Dependência de um único especialista em Cobol legado",
    category: "Pessoas",
    owner: "Rafael Mendes",
    probability: 3,
    impact: 4,
    mitigation: "Documentar rotinas críticas na Wiki e formar segundo especialista até Abr/2026.",
  },
  {
    id: "r3",
    title: "Vazamento de dados pessoais em ambiente de teste",
    category: "Segurança / LGPD",
    owner: "Vinícius Galantine",
    probability: 2,
    impact: 5,
    mitigation: "Anonimização automática das bases restauradas em ambientes não produtivos.",
  },
  {
    id: "r4",
    title: "Custos de nuvem acima do orçamento",
    category: "Financeiro",
    owner: "Henrique Fernandes",
    probability: 3,
    impact: 3,
    mitigation: "Budget alerts na AWS, revisão mensal de instâncias e uso de savings plans.",
  },
  {
    id: "r5",
    title: "Indeferimento do pedido de patente no INPI",
    category: "Jurídico",
    owner: "Weverson Rafael",
    probability: 2,
    impact: 3,
    mitigation: "Busca de anterioridade ampliada e redação assistida por escritório especializado.",
  },
  {
    id: "r6",
    title: "Resistência das áreas à troca do sistema atual",
    category: "Mudança",
    owner: "Pedro Costa",
    probability: 4,
    impact: 2,
    mitigation: "Plano de treinamento por área e key-users participando das validações.",
  },
];

export function severityTone(score: number) {
  if (score >= 15) return "danger" as const;
  if (score >= 9) return "warning" as const;
  if (score >= 4) return "info" as const;
  return "success" as const;
}

export function severityLabel(score: number) {
  if (score >= 15) return "Crítica";
  if (score >= 9) return "Alta";
  if (score >= 4) return "Moderada";
  return "Baixa";
}
