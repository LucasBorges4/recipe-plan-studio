import type { Role } from "@/lib/rbac";

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

export type Stage = "not_started" | "in_progress" | "waiting_client" | "review" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  column: string;
  priority: Priority;
  tags: string[];
  assignee: string;
  stage: Stage;
  progress: number;
  responsible: string | null;
  waitingOnClient: boolean;
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
  role: Role;
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
  updatedBy?: string;
}

export type RiskStatus = "ativo" | "critico" | "em_tratamento" | "mitigado" | "pendente_cliente";

export interface Risk {
  id: string;
  title: string;
  category: string;
  owner: string;
  role: Role;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  mitigation: string;
  status?: RiskStatus;
  nextAction?: string;
  due?: string | null;
  taskId?: string | null;
}

/** Canal de contato de um membro da equipe. Sem backend nesta etapa. */
export interface ContactChannel {
  type: "whatsapp" | "email" | "meeting";
  label: string;
  value: string;
}

/** Endereço de e-mail opcional do membro para contato direto. */
export interface TeamMemberContact {
  email?: string;
}

/** Destaque visual do membro: primário (Gérson), secundário (Camila) ou simples. */
export type TeamMemberTier = "lead" | "secondary" | "member";

/** Selo de destaque do líder: coroa (estratégico) ou estrela (responsável pelo projeto). */
export type TeamLeaderBadge = "crown" | "star";

/** Grupo em que o membro aparece na página /equipe (sem dados imaginados — RNF13). */
export type TeamGroup = "projeto" | "engenharia";

/** Membro da equipe exibido na página /equipe. */
export interface TeamMember {
  id: string;
  name: string;
  /** Grupo de exibição na página /equipe (padrão: "projeto"). */
  group?: TeamGroup;
  /** Cargo exibido sempre em inglês. */
  role: string;
  /** Área de atuação (ex.: Geociências). */
  area: string;
  photo?: string;
  /** Bio somente nos destaques (lead/secondary). */
  bio?: string;
  /** Frentes que o destaque lidera (ex.: "Visão • Pesquisa • Inovação"). */
  fronts?: string[];
  /** Selo visual do destaque (coroa/estrela). */
  badge?: TeamLeaderBadge;
  /** Assinatura lateral do destaque (ex.: "CIÊNCIA / INOVAÇÃO / RESULTADOS"). */
  signature?: string;
  tier: TeamMemberTier;
  /** Responsável pelo acompanhamento com o cliente. */
  primaryContact?: boolean;
  /** E-mail para contato direto. */
  email?: string | null;
  /** Canais reais; vazio até o dado chegar (RNF07). */
  channels: ContactChannel[];
}

/** Anexo de um evento da timeline. */
export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
}

/** Comentário de um evento da timeline. */
export interface TimelineComment {
  id: string;
  author: string;
  authorPhoto?: string;
  date: string;
  text: string;
}

/** Tipo de evento exibido na timeline. */
export type TimelineEventKind = "entrega" | "integracao" | "decisao" | "aprovacao" | "marco" | "atualizacao";

/** Status de um evento da timeline. */
export type TimelineEventStatus = "aprovado" | "aguardando_aprovacao" | "em_andamento";

/** Evento da linha do tempo do projeto. */
export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  title: string;
  description: string;
  author: string;
  authorPhoto?: string;
  date: string;
  status: TimelineEventStatus;
  attachments: Attachment[];
  comments: TimelineComment[];
  /** Registro de aprovação (quem aprovou e quando), quando aplicável. */
  approvedBy?: string;
  approvedAt?: string;
}

export interface JournalComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  editedAt?: string;
}

export interface JournalAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface JournalEntry {
  id: string;
  type: "Entrega" | "Integração" | "Marco" | "Decisão" | "Aprovação" | "Atualização";
  title: string;
  description: string;
  occurredAt: string;
  status: "Em andamento" | "Entregue" | "Aguardando aprovação" | "Aprovado pelo cliente" | "Concluído" | "Requer atenção";
  authorId: string;
  authorName: string;
  department?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvedNote?: string;
  comments: JournalComment[];
  attachments: JournalAttachment[];
}

export interface TechItem {
  name: string;
  category: string;
  description: string;
  icon?: string;
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
