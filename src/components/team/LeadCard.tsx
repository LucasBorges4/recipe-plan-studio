import { Crown, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/components/portal/Avatar";
import { ContactDialog } from "@/components/team/ContactDialog";
import { PHOTO_ASPECT_CSS } from "@/lib/photo-frame";
import type { TeamMember } from "@/data/types";

export function LeadCard({
  member,
  secondary = false,
  className,
}: {
  member: TeamMember;
  secondary?: boolean;
  className?: string;
}) {
  const isPrimary = !secondary && member.tier === "lead";
  const BadgeIcon = isPrimary ? Crown : Star;

  return (
    <Card
      className={cn(
        "relative w-full overflow-hidden border",
        isPrimary ? "border-brand/20 bg-brand-soft/30" : "border-success/20 bg-success-soft/30",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6">
        <Avatar className={cn("shrink-0 rounded-lg border-2 bg-card", isPrimary ? "h-28 w-28 border-brand/30" : "h-20 w-20 border-success/30")}>
          <AvatarImage src={member.photo} alt={member.name} loading={isPrimary ? undefined : "lazy"} />
          <AvatarFallback className={cn("text-3xl font-semibold", isPrimary ? "text-brand bg-brand-soft" : "text-success bg-success-soft")}>
            {initials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide",
              isPrimary ? "bg-brand text-brand-foreground" : "bg-success text-success-foreground",
            )}
          >
            <BadgeIcon className="size-3 shrink-0" aria-hidden />
            {isPrimary ? "LIDERANÇA ESTRATÉGICA" : "RESPONSÁVEL PELO PROJETO"}
          </span>
          {member.fronts && member.fronts.length > 0 && (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {member.fronts.join(" • ")}
            </p>
          )}
          <h3 className="mt-1 font-extrabold text-foreground">{member.name}</h3>
          <p className={cn("text-sm font-semibold", isPrimary ? "text-brand" : "text-success")}>
            {member.role}
          </p>
          {member.area && <p className="mt-0.5 text-xs text-muted-foreground">{member.area}</p>}
          {member.signature && (
            <p className={cn("mt-1 text-[10px] font-semibold uppercase tracking-[0.2em]", isPrimary ? "text-brand/70" : "text-success/70")}>
              {member.signature}
            </p>
          )}
        </div>
      </CardContent>
      <div className="px-6 pb-4">
        <ContactDialog member={member} />
      </div>
    </Card>
  );
}
