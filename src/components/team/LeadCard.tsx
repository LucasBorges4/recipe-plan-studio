import { Crown, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContactDialog } from "@/components/team/ContactDialog";
import { initials } from "@/components/portal/Avatar";
import { cn } from "@/lib/utils";

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
  const badgeLabel = isPrimary ? "LIDERANÇA ESTRATÉGICA" : "RESPONSÁVEL PELO PROJETO";
  const BadgeIcon = isPrimary ? Crown : Star;

  return (
    <Card
      className={cn(
        "relative w-full overflow-hidden border",
        isPrimary ? "border-brand/20 bg-brand-soft/40" : "border-success/20 bg-success-soft/40",
        className,
      )}
    >
      <CardContent
        className={cn(
          "flex h-full flex-col gap-5",
          isPrimary ? "p-6 sm:p-8 md:flex-row md:items-center" : "p-6",
        )}
      >
        <div
          className={cn(
            "flex gap-5",
            isPrimary
              ? "md:flex-row md:items-center"
              : "flex-col items-start gap-4 md:flex-row md:items-start",
          )}
        >
          <Avatar
            className={cn(
              "shrink-0 rounded-lg border-4 bg-card",
              isPrimary
                ? "h-44 border-brand/30 ring-2 ring-offset-2 ring-brand/40 sm:h-48"
                : "h-32 border-success/30 ring-2 ring-offset-2 ring-success/40",
            )}
          >
            <AvatarImage
              src={member.photo}
              alt={`Foto de ${member.name}`}
              loading={isPrimary ? undefined : "lazy"}
            />
            <AvatarFallback
              className={cn(
                "text-3xl font-semibold",
                isPrimary ? "text-brand bg-brand-soft" : "text-success bg-success-soft",
              )}
            >
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
              <BadgeIcon className="size-3.5 shrink-0" aria-hidden />
              {badgeLabel}
            </span>

            {member.fronts && member.fronts.length > 0 && (
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {member.fronts.join(" • ")}
              </p>
            )}

            <h3
              className={cn(
                "mt-1 font-extrabold text-foreground",
                isPrimary ? "text-4xl" : "text-3xl",
              )}
            >
              {member.name}
            </h3>
            <p className={cn("text-sm font-semibold", isPrimary ? "text-brand" : "text-success")}>
              {member.role}
            </p>
            {member.area && <p className="mt-0.5 text-xs text-muted-foreground">{member.area}</p>}
            {member.bio && (
              <p
                className={cn(
                  "mt-3 text-sm leading-relaxed text-foreground/80",
                  isPrimary ? "max-w-2xl" : "line-clamp-3",
                )}
              >
                {member.bio}
              </p>
            )}
          </div>
        </div>

        {member.signature && (
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.2em]",
              isPrimary ? "text-brand/70" : "text-success/70",
            )}
          >
            {member.signature}
          </p>
        )}

        <div className="mt-auto">
          <ContactDialog member={member} />
        </div>
      </CardContent>
    </Card>
  );
}
