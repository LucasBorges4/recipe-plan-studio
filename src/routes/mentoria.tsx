import { Link, createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/api-hooks";
import {
  GraduationCap,
  BarChart2,
  Lightbulb,
  ExternalLink,
  Laptop,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const featureCards = [
  {
    icon: GraduationCap,
    iconColor: "text-brand",
    title: "Conteúdo prático",
    description: "Aulas e exercícios focados na aplicação real.",
  },
  {
    icon: BarChart2,
    iconColor: "text-success",
    title: "Acompanhamento na plataforma externa",
    description: "Acesse seus materiais e acompanhe sua evolução.",
  },
  {
    icon: Lightbulb,
    iconColor: "text-warning",
    title: "Material aplicado à realidade da ZAGGO",
    description: "Conteúdo direcionado aos desafios do seu dia a dia.",
  },
];

export default function MentoriaPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "Pedrão";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      <section className="space-y-6">
        <Card className="shadow-sm border-border bg-white">
          <CardContent className="pt-6">
            <div className="mb-6">
              <p className="text-lg font-semibold text-foreground">Olá, {userName.split(" ")[0]}!</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Mentoria IA</h1>
              <p className="mt-2 text-base text-muted-foreground max-w-2xl">
                Acesse o portal de aprendizado e acompanhe sua evolução na mentoria de Inteligência Artificial.
              </p>
            </div>

            <div className="border-t border-border pt-6">
              <div className="mb-4">
                <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">PORTAL DE APRENDIZADO</p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">Acesse o portal da mentoria</h2>
                <p className="mt-2 text-base text-muted-foreground max-w-xl">
                  Na plataforma da mentoria você pode acessar as aulas, materiais, exercícios e acompanhar sua evolução diretamente na plataforma da mentoria.
                </p>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-6 bg-brand text-brand-foreground font-semibold shadow-sm hover:shadow-md hover:bg-brand/90 transition-all"
                  >
                    <Link to="#" className="flex items-center gap-2">
                      <ExternalLink className="size-4" />
                      Acessar portal da mentoria
                      <ExternalLink className="size-4" />
                    </Link>
                  </Button>
                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="size-4 text-info" />
                    Ao clicar, você será direcionado para uma plataforma externa desenvolvida em R, onde está hospedada a mentoria.
                  </p>
                </div>
                <div className="relative hidden lg:block w-80">
                  <div className="relative aspect-[4/3] rounded-xl bg-gradient-to-br from-muted via-muted/50 to-background shadow-xl shadow-black/5 ring-1 ring-border overflow-hidden">
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                      <Laptop className="size-16 text-muted-foreground/30 mb-4" />
                      <div className="w-full max-w-xs bg-white rounded-lg p-4 shadow-lg border border-border">
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">ZAGGO Mentoria IA</p>
                          <p className="text-sm text-muted-foreground mt-1">Aprendizado prático para aplicação no seu dia a dia</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="space-y-4">
        {featureCards.map((card, index) => (
          <Card key={index} className="shadow-sm border-border bg-white hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                  <card.icon className={cn("size-6", card.iconColor)} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/mentoria")({
  component: MentoriaPage,
});
