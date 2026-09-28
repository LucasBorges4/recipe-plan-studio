import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/components/portal/Avatar";
import {
  EVENT_KIND_META,
  EVENT_STATUS_META,
  formatEventDateTime,
  latestEvents,
} from "@/lib/equipe-utils";
import type { TimelineEvent } from "@/data/types";

export function LatestUpdates({ events, limit = 4 }: { events: TimelineEvent[]; limit?: number }) {
  const recent = latestEvents(events, limit);
  return (
    <Card className="w-full border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="size-4 text-brand" />
          Últimas atualizações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {recent.length === 0 ? (
          <p className="px-1 py-2 text-center text-sm text-muted-foreground">
            Nenhuma atualização registrada ainda.
          </p>
        ) : (
          recent.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
            >
              <Avatar className="h-8 shrink-0 border border-border">
                <AvatarImage src={e.authorPhoto} alt={`Foto de ${e.author}`} loading="lazy" />
                <AvatarFallback className="text-xs font-semibold text-brand bg-brand-soft">
                  {initials(e.author)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{e.title}</span>
                  <StatusBadge tone={EVENT_STATUS_META[e.status].tone}>
                    {EVENT_STATUS_META[e.status].label}
                  </StatusBadge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {EVENT_KIND_META[e.kind].label} · {e.author} · {formatEventDateTime(e.date)}
                </p>
                <a
                  href={`#evento-${e.id}`}
                  className="mt-0.5 inline-block text-xs font-medium text-brand underline-offset-2 hover:underline"
                >
                  Ver na linha do tempo
                </a>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}