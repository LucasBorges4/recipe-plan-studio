import { z } from "zod";

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
