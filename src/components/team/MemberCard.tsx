import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContactDialog } from "@/components/team/ContactDialog";
import { initials } from "@/components/portal/Avatar";

import type { TeamMember } from "@/data/types";

export function MemberCard({ member }: { member: TeamMember }) {
  return (
    <Card className="w-full border-border bg-card">
      <CardContent className="flex h-full flex-col items-center gap-3 p-6 text-center">
        <Avatar className="h-20 shrink-0 rounded-lg border-4 border-white ring-2 ring-offset-2 ring-gray-100 sm:h-24">
          <AvatarImage src={member.photo} alt={`Foto de ${member.name}`} loading="lazy" />
          <AvatarFallback className="text-2xl font-semibold text-brand bg-brand-soft">
            {initials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h4 className="truncate text-base font-semibold text-foreground">{member.name}</h4>
          <p className="mt-0.5 text-sm font-medium text-brand">
            {member.role || "Papel a definir"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {member.area || "Área a definir"}
          </p>
        </div>
        <div className="mt-auto pt-2">
          <ContactDialog member={member} />
        </div>
      </CardContent>
    </Card>
  );
}
