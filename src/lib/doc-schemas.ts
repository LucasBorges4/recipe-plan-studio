import { z } from "zod";
import type { DocRecord } from "@/lib/records";

/**
 * Schemas dos registros genéricos de módulo.
 * Usados no servidor (validação autoritativa em saveRecordFn) e no cliente
 * (formulários e leitura tipada dos registros retornados pela API).
 */

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

/** Filtra os registros de um tipo e descarta os que não passam pelo schema. */
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
