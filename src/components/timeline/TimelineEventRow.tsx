import { useState } from "react";
import {
  PackageCheck,
  Scale,
  BadgeCheck,
  Flag,
  RefreshCw,
  Link,
  Paperclip,
  FileText,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { initials } from "@/components/portal/Avatar";
import {
  EVENT_KIND_META,
  EVENT_STATUS_META,
  formatBytes,
  formatEventDate,
  formatEventDateTime,
} from "@/lib/equipe-utils";
import type { TimelineEvent } from "@/data/types";

const kindIcon = {
  entrega: PackageCheck,
  integracao: Link,
  decisao: Scale,
  aprovacao: BadgeCheck,
  marco: Flag,
  atualizacao: RefreshCw,
} as const;

const toneIconBg: Record<string, string> = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-neutral-soft text-muted-foreground",
  brand: "bg-brand-soft text-brand",
};

const toneLabel: Record<string, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  neutral: "text-muted-foreground",
  brand: "text-brand",
};

export function TimelineEventRow({ event }: { event: TimelineEvent }) {
  const [openComments, setOpenComments] = useState(false);
  const Icon = kindIcon[event.kind];

  return (
    <article id={`evento-${event.id}`} className="relative scroll-mt-24 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full ${toneIconBg[EVENT_KIND_META[event.kind].tone]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${toneLabel[EVENT_KIND_META[event.kind].tone]}`}>
              {EVENT_KIND_META[event.kind].label}
            </span>
            <StatusBadge tone={EVENT_STATUS_META[event.status].tone}>
              {EVENT_STATUS_META[event.status].label}
            </StatusBadge>
          </div>
          <h3 className="mt-1 font-semibold text-foreground">{event.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">{event.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 border border-border">
                <AvatarImage src={event.authorPhoto} alt={`Foto de ${event.author}`} loading="lazy" />
                <AvatarFallback className="text-[10px] font-semibold text-brand bg-brand-soft">
                  {initials(event.author)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {event.author} · {formatEventDateTime(event.date)}
              </span>
            </div>
            {event.approvedBy && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <BadgeCheck className="size-3.5 shrink-0" />
                Aprovado por {event.approvedBy}
                {event.approvedAt ? ` em ${formatEventDate(event.approvedAt)}` : ""}
              </span>
            )}
          </div>

          {event.attachments.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Paperclip className="size-3.5" />
                Anexos ({event.attachments.length})
              </p>
              {event.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent"
                >
                  <FileText className="size-3.5 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {a.mime.split("/")[1]?.toUpperCase()}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{formatBytes(a.size)}</span>
                </a>
              ))}
            </div>
          )}

          {event.comments.length > 0 && (
            <div className="mt-3 border-t border-border/60 pt-3">
              <Collapsible open={openComments} onOpenChange={setOpenComments}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-md px-2 text-xs text-muted-foreground"
                    aria-expanded={openComments}
                  >
                    <MessageSquare className="size-3.5" />
                    Comentários ({event.comments.length})
                    <ChevronDown
                      className={`size-3.5 transition-transform ${openComments ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {event.comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                      <Avatar className="h-6 border border-border">
                        <AvatarImage src={c.authorPhoto} alt={`Foto de ${c.author}`} loading="lazy" />
                        <AvatarFallback className="text-[10px] font-semibold text-brand bg-brand-soft">
                          {initials(c.author)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">
                          {c.author}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {formatEventDate(c.date)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}