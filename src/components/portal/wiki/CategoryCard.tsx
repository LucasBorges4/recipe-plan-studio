import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Compass,
  Workflow,
  ShieldCheck,
  Zap,
  FileText,
  HelpCircle,
  GraduationCap,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryMeta {
  icon: LucideIcon;
  subtitle: string;
  tint: string;
}

const META: Record<string, CategoryMeta> = {
  "Sobre o Projeto": {
    icon: BookOpen,
    subtitle: "Visão geral do portal e do ecossistema GWG.",
    tint: "bg-brand/10 text-brand",
  },
  "Como usar o sistema": {
    icon: Compass,
    subtitle: "Guias passo a passo de cada módulo.",
    tint: "bg-info/10 text-info",
  },
  "Processos da GWG": {
    icon: Workflow,
    subtitle: "Fluxos de aprovação, evidências e revisões.",
    tint: "bg-warning/10 text-warning",
  },
  Compliance: {
    icon: ShieldCheck,
    subtitle: "Controles, prazos e conformidade.",
    tint: "bg-success/10 text-success",
  },
  "Integracoes e Automacoes": {
    icon: Zap,
    subtitle: "Automações e integrações do portal.",
    tint: "bg-brand/10 text-brand",
  },
  "Documentos e Referencias": {
    icon: FileText,
    subtitle: "Políticas, termos e referências.",
    tint: "bg-muted text-muted-foreground",
  },
  "Perguntas Frequentes": {
    icon: HelpCircle,
    subtitle: "Dúvidas comuns com respostas rápidas.",
    tint: "bg-info/10 text-info",
  },
  Treinamentos: {
    icon: GraduationCap,
    subtitle: "Materiais de onboarding e capacitação.",
    tint: "bg-success/10 text-success",
  },
};

const FALLBACK: CategoryMeta = {
  icon: Circle,
  subtitle: "Conhecimento organizado por categoria.",
  tint: "bg-muted text-muted-foreground",
};

export function CategoryCard({
  category,
  count,
  active,
  onClick,
}: {
  category: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const meta = META[category] ?? FALLBACK;
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all",
        active
          ? "border-brand bg-brand-soft"
          : "border-border bg-card hover:border-brand/50 hover:shadow-md",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
          meta.tint,
        )}
      >
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{category}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {meta.subtitle}
        </span>
      </span>
      <span className="text-[11px] font-medium text-muted-foreground">
        {count} artigo{count === 1 ? "" : "s"}
      </span>
    </button>
  );
}