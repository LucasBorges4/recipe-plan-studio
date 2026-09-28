import { Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContactDialog } from "@/components/team/ContactDialog";
import { initials } from "@/components/portal/Avatar";
import { PHOTO_ASPECT_CSS } from "@/lib/photo-frame";
import type { TeamMember } from "@/data/types";

export function MemberCard({ member }: { member: TeamMember }) {
  const content = (
    <div className="flex flex-col items-center gap-3 text-center">
      <Avatar className={`h-16 w-16 shrink-0 rounded-lg border-2 border-white ${PHOTO_ASPECT_CSS}`}>
        <AvatarImage src={member.photo} alt={member.name} loading="lazy" />
        <AvatarFallback className="text-xl font-semibold text-brand bg-brand-soft">
          {initials(member.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h4 className="truncate text-sm font-semibold text-foreground">{member.name}</h4>
        <p className="mt-0.5 text-xs font-medium text-brand">{member.role || "—"}</p>
        {member.area && (
          <p className="truncate text-[11px] text-muted-foreground">{member.area}</p>
        )}
      </div>
      <div className="mt-auto pt-2">
        <ContactDialog member={member} />
      </div>
    </div>
  );

  if (!member.email) return content;

  return (
    <a
      href={`mailto:${member.email}`}
      className="group block rounded-xl border border-border bg-card p-5 hover:border-brand/40 hover:shadow-md transition-all"
    >
      {content}
    </a>
  );
}
