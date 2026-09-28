import { useState } from "react";
import { Mail, MessageCircle, CalendarClock, PhoneOff, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildChannels, contactLabel, PROJECT_NAME } from "@/lib/equipe-utils";
import type { TeamMember } from "@/data/types";

const channelIcon = { whatsapp: MessageCircle, email: Mail, meeting: CalendarClock } as const;

export function ContactDialog({ member }: { member: TeamMember }) {
  const [open, setOpen] = useState(false);
  const channels = buildChannels(member);
  const hasChannels = channels.length > 0;
  const label = contactLabel(member);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant={member.tier === "member" ? "ghost" : "default"}
        onClick={() => hasChannels && setOpen(true)}
        disabled={!hasChannels}
        aria-label={label}
        title={hasChannels ? label : "Contato ainda não disponível"}
        className={member.tier === "member" ? "justify-start px-2 text-muted-foreground" : ""}
      >
        <MessageCircle className="size-4" />
        <span className="sr-only xs:not-sr-only sm:inline">{label}</span>
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="size-4 text-brand" />
            {label}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {member.role} · {PROJECT_NAME}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 py-1">
          {channels.length === 0 && (
            <p className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              <PhoneOff className="size-4 shrink-0" />
              Os canais de contato de {member.name} ainda não foram cadastrados.
            </p>
          )}
          {channels.map((c) => {
            const Icon = channelIcon[c.type];
            return (
              <a
                key={c.type}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${c.label} de ${member.name}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="size-4 shrink-0 text-brand" />
                  {c.label}
                </span>
                <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
              </a>
            );
          })}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-md px-5">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}