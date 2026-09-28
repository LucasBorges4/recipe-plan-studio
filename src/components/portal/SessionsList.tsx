import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { qk } from "@/lib/api-hooks";
import { useRevokeSessions } from "@/lib/api-hooks";
import { toast } from "sonner";

interface SessionsListProps {
  sessions: { tokenHash: string; createdAt: string; expiresAt: string }[];
}

export function SessionsList({ sessions }: SessionsListProps) {
  const qc = useQueryClient();
  const revokeSessionsM = useRevokeSessions();

  if (sessions.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold text-foreground">Sessões ativas</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {sessions.length} sessão(ões) ativa(s).
      </p>
      <ul className="mt-3 space-y-2">
        {sessions.map((s) => (
          <li
            key={s.tokenHash}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs"
          >
            <span className="text-muted-foreground">
              Criada em: {new Date(s.createdAt).toLocaleDateString("pt-BR")} · Expira em:{" "}
              {new Date(s.expiresAt).toLocaleDateString("pt-BR")}
            </span>
          </li>
        ))}
      </ul>
      <button
        disabled={revokeSessionsM.isPending}
        onClick={() => revokeSessionsM.mutate()}
        className="mt-3 rounded-md bg-danger px-4 py-2 text-xs font-medium text-white hover:bg-danger/90 disabled:opacity-50"
      >
        {revokeSessionsM.isPending ? "Revogando..." : "Revogar todas as sessões"}
      </button>
    </div>
  );
}
