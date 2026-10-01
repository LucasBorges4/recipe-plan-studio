import { Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SectionHeader } from "@/components/portal/SectionHeader";
import { Avatar } from "@/components/portal/Avatar";
import { PanelCard } from "@/components/portal/PanelCard";
import { photoForName } from "@/lib/team-photos";

interface TeamSectionProps {
  teamList: { id: string; name: string; role?: string; area?: string; tier?: string; photo?: string }[];
}

export function TeamSection({ teamList }: TeamSectionProps) {
  const sortedList = [...teamList].sort(
    (a, b) => (a.tier === "lead" ? 0 : 1) - (b.tier === "lead" ? 0 : 1),
  );

  return (
    <PanelCard>
      <SectionHeader
        title="Equipe responsável"
        subtitle="Equipe completa do projeto"
        icon={Users}
        actions={
          <Link to="/equipe" className="text-xs font-semibold text-brand hover:underline">
            Ver todos
          </Link>
        }
      />
      {sortedList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          Nenhum membro cadastrado na equipe.
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {sortedList.map((tm) => (
            <li key={tm.id}>
              <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                <Avatar name={tm.name} avatarUrl={tm.photo ?? photoForName(tm.name) ?? null} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate text-foreground">{tm.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {tm.role || tm.area || "Papel a definir"}
                    {tm.tier === "lead" && tm.role ? " · Liderança" : ""}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
