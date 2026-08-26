import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { createInviteFn, listInvitesFn, revokeInviteFn } from "@/lib/portal-api";
import { roles, roleLabel, type Role } from "@/lib/rbac";

/**
 * Convites de cadastro: o administrador emite um código secreto por e-mail e
 * compartilha o link /login?convite=CÓDIGO. O código só existe em claro neste
 * momento — o banco guarda apenas o SHA-256.
 */

const qkInvites = ["invites"] as const;

function inviteUrl(code: string, email: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/login?convite=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;
}

export function InvitesPanel() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("desenvolvedor");
  const [days, setDays] = useState(7);
  const [issued, setIssued] = useState<{ code: string; email: string } | null>(null);

  const invites = useQuery({
    queryKey: qkInvites,
    queryFn: () => listInvitesFn(),
  });

  const create = useMutation({
    mutationFn: () => createInviteFn({ data: { email, role, days } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setIssued(res.data);
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: qkInvites });
      toast.success("Convite emitido. Copie o link antes de fechar.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao emitir convite."),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeInviteFn({ data: { id } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: qkInvites });
      toast.success("Convite revogado.");
    },
  });

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const list = invites.data?.ok ? invites.data.data : [];

  return (
    <div className="space-y-6">
      <form
        className="rounded-xl border border-border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <h3 className="text-sm font-semibold text-foreground">Emitir convite</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          O cadastro no portal só é possível com convite. O código é gerado com 160 bits de
          entropia, vinculado ao e-mail informado e de uso único.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_120px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">E-mail do convidado</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@grupogeos.com.br"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-role">Papel</Label>
            <select
              id="inv-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-days">Validade (dias)</Label>
            <Input
              id="inv-days"
              type="number"
              min={1}
              max={60}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Emitindo..." : "Emitir"}
          </Button>
        </div>
      </form>

      {issued ? (
        <div className="rounded-xl border border-brand/30 bg-brand-soft p-5">
          <p className="text-sm font-semibold text-foreground">
            Convite de {issued.email} — copie agora
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Este código não será exibido novamente. Envie-o pelo canal oficial.
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-card px-3 py-2 text-xs">
                {issued.code}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={() => copy(issued.code)}>
                <Copy className="mr-1.5 size-3.5" /> Código
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-card px-3 py-2 text-xs">
                {inviteUrl(issued.code, issued.email)}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copy(inviteUrl(issued.code, issued.email))}
              >
                <Link2 className="mr-1.5 size-3.5" /> Link
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIssued(null)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Já copiei, ocultar
          </button>
        </div>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {list.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{i.email}</p>
              <p className="text-xs text-muted-foreground">
                {i.role} · código {i.hint}••••• · emitido por {i.createdByName} em{" "}
                {new Date(i.createdAt).toLocaleString("pt-BR")} · expira em{" "}
                {new Date(i.expiresAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <StatusBadge
              tone={i.status === "Pendente" ? "info" : i.status === "Utilizado" ? "success" : "warning"}
            >
              {i.status}
            </StatusBadge>
            <button
              type="button"
              aria-label={`Revogar convite de ${i.email}`}
              className="text-muted-foreground transition-colors hover:text-danger"
              onClick={() => revoke.mutate(i.id)}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {list.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">
            {invites.isLoading ? "Carregando convites..." : "Nenhum convite emitido."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
