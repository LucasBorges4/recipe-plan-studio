export type StatusTone = "success" | "info" | "warning" | "neutral" | "danger" | "brand";

export type Priority = "Alta" | "Média" | "Baixa";

export interface Module {
  id: string;
  name: string;
  status: string;
  tone: StatusTone;
  date: string;
  done: number;
  total: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  column: string;
  priority: Priority;
  tags: string[];
  assignee: string;
  due?: string;
  comments?: number;
}

export interface Milestone {
  id: string;
  date: string;
  type: "Entrega" | "Integração" | "Marco" | "Decisão";
  title: string;
  description: string;
}

export interface Release {
  version: string;
  date: string;
  items: string[];
}

export interface ComplianceControl {
  id: string;
  control: string;
  norm: "LGPD" | "ISO 27001" | "SOX";
  owner: string;
  status: string;
  tone: StatusTone;
  lastReview: string;
  nextReview: string;
  overdue?: boolean;
}

export interface WikiArticle {
  slug: string;
  title: string;
  category: string;
  summary: string;
  updatedAt: string;
  version: string;
  sections: { heading: string; body: string }[];
}

export interface Risk {
  id: string;
  title: string;
  category: string;
  owner: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  mitigation: string;
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  links: { label: string; href: string }[];
}

export interface TechItem {
  name: string;
  category: string;
  description: string;
}

export interface PatentStage {
  id: string;
  title: string;
  description: string;
  owner: string;
  deadline: string;
  status: "Concluído" | "Em Andamento" | "Pendente" | "Aguardando";
}

export interface LegalDoc {
  title: string;
  subtitle: string;
  updatedAt: string;
  version: string;
  intro: string;
  clauses: { title: string; body: string }[];
}
