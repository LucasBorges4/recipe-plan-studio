import { Handshake } from "lucide-react";

export function InstitutionalBanner() {
  return (
    <section
      aria-label="Faixa institucional da equipe"
      className="mt-5 rounded-2xl border border-border bg-brand-soft/50 px-5 py-6 sm:px-7"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Handshake className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Uma equipe multidisciplinar, focada no seu sucesso.
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Ciência, tecnologia e gestão trabalhando juntas para entregar uma geotecnologia
              sob medida à visão e às necessidades do Grupo W. Geotec.
            </p>
          </div>
        </div>
        <p className="shrink-0 text-sm font-semibold text-brand sm:max-w-[15rem] sm:text-right">
          Mais que um projeto. Uma parceria para o futuro.
        </p>
      </div>
    </section>
  );
}