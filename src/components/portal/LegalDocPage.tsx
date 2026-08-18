import { FileText } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { NoticeBanner } from "./NoticeBanner";
import { StatusBadge } from "./StatusBadge";
import type { LegalDoc } from "@/data/types";

export function LegalDocPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <PageHeader icon={FileText} title={doc.title} subtitle={doc.subtitle} />
      <p className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        Última atualização: {doc.updatedAt}
        <StatusBadge tone="success">{doc.version}</StatusBadge>
      </p>
      <NoticeBanner />

      <div className="max-w-3xl">
        <p className="text-sm leading-relaxed text-muted-foreground">{doc.intro}</p>

        <ol className="mt-6 space-y-4">
          {doc.clauses.map((c, i) => (
            <li
              key={c.title}
              id={`clausula-${i + 1}`}
              className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
            >
              <h2 className="text-sm font-semibold text-foreground">
                {i + 1}. {c.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
