import { z } from "zod";
import type { DocRecord } from "@/lib/records";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD (ISO)");

export const nextStepSchema = z.object({
  title: z.string().trim().min(3).max(120),
  due: isoDateSchema,
  status: z.enum(["pendente", "em_andamento", "concluido"]).default("pendente"),
});

export const legalDocSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(40),
  title: z.string().trim().min(3).max(120),
  subtitle: z.string().trim().max(200).optional().default(""),
  version: z.string().trim().min(1).max(20),
  intro: z.string().trim().max(2000).optional().default(""),
  clauses: z
    .array(z.object({ title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(5000) }))
    .min(1)
    .max(30),
  publishedAt: isoDateSchema,
});

export function toISODate(input: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const br = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function isFutureISO(iso: string): boolean {
  return iso > new Date().toISOString().slice(0, 10);
}

export const docKinds = ["risk", "milestone", "release", "tech", "member", "patent", "wiki"] as const;
export type DocKind = (typeof docKinds)[number];

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const riskSchema = z.object({
  title: text(3, 160),
  category: text(2, 60),
  owner: text(2, 80),
  probability: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  mitigation: text(3, 800),
});

export const milestoneSchema = z.object({
  date: text(3, 40),
  type: z.enum(["Entrega", "Integração", "Marco", "Decisão"]),
  title: text(3, 160),
  description: text(3, 800),
});

export const releaseSchema = z.object({
  version: text(1, 30),
  date: text(3, 40),
  items: z.array(text(1, 200)).min(1).max(20),
});

export const techSchema = z.object({
  name: text(1, 60),
  category: text(2, 60),
  description: text(3, 300),
});

export const memberSchema = z.object({
  name: text(2, 80),
  role: text(2, 80),
  bio: text(3, 500),
});

export const patentSchema = z.object({
  title: text(3, 160),
  description: text(3, 800),
  owner: text(2, 80),
  deadline: text(3, 40),
  status: z.enum(["Concluído", "Em Andamento", "Pendente", "Aguardando"]),
});

export const wikiSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  title: text(3, 160),
  category: text(2, 60),
  summary: text(3, 400),
  version: text(1, 20),
  sections: z
    .array(z.object({ heading: text(2, 120), body: text(3, 4000) }))
    .min(1, "Inclua ao menos uma seção")
    .max(20),
});

export const docSchemas = {
  risk: riskSchema,
  milestone: milestoneSchema,
  release: releaseSchema,
  tech: techSchema,
  member: memberSchema,
  patent: patentSchema,
  wiki: wikiSchema,
} as const;

export type RiskDoc = z.infer<typeof riskSchema>;
export type MilestoneDoc = z.infer<typeof milestoneSchema>;
export type ReleaseDoc = z.infer<typeof releaseSchema>;
export type TechDoc = z.infer<typeof techSchema>;
export type MemberDoc = z.infer<typeof memberSchema>;
export type PatentDoc = z.infer<typeof patentSchema>;
export type WikiDoc = z.infer<typeof wikiSchema>;

export interface Doc<T> {
  id: string;
  updatedAt: string;
  data: T;
}

export const docKindLabel: Record<DocKind, string> = {
  risk: "risco",
  milestone: "marco",
  release: "release",
  tech: "tecnologia",
  member: "integrante",
  patent: "etapa da patente",
  wiki: "artigo da wiki",
};

export function readDocs<K extends DocKind>(
  docs: DocRecord[] | undefined,
  kind: K,
): Doc<z.infer<(typeof docSchemas)[K]>>[] {
  if (!docs) return [];
  const schema = docSchemas[kind];
  const out: Doc<z.infer<(typeof docSchemas)[K]>>[] = [];
  for (const d of docs) {
    if (d.kind !== kind) continue;
    const parsed = schema.safeParse(d.data);
    if (parsed.success) {
      out.push({
        id: d.id,
        updatedAt: d.updatedAt,
        data: parsed.data as z.infer<(typeof docSchemas)[K]>,
      });
    }
  }
  return out;
}
