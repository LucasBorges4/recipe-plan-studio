import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ScrollText, ShieldAlert, Download } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { can, auditableRoleLabel, roleLabel } from "@/lib/rbac";
import { formatDateTime } from "@/lib/portal-utils";
import { useAuditList, useSession } from "@/lib/api-hooks";

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "Trilha de auditoria do portal: quem fez, quando fez, o que mudou e por quê, em registro somente-inserção.",
      },
      { property: "og:title", content: "Auditoria — Grupo Geos" },
      {
        property: "og:description",
        content: "Histórico imutável de ações sobre tarefas, controles e evidências.",
      },
    ],
  }),
  component: AuditoriaPage,
});

function AuditoriaPage() {
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const allowed = !!user && can(user.role, "audit.read");
  const { data: res } = useAuditList(allowed);
  const audit = res?.ok ? res.data : [];

  const [entity, setEntity] = useState("Todas");

  if (!allowed) {
    return (
      <>
        <PageHeader icon={ScrollText} title="Auditoria" subtitle="Trilha de registro do portal" />
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto size-6 text-warning" />
          <p className="mt-3 text-sm font-medium text-foreground">Acesso restrito</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A trilha de auditoria é visível a administrador, diretor e auditor. Você está como{" "}
            {user ? `${user.name} (${roleLabel[user.role]})` : "usuário não autenticado"}.
          </p>
        </div>
      </>
    );
  }

  const entities = ["Todas", ...Array.from(new Set(audit.map((a) => a.entity)))];
  const list = audit.filter((a) => entity === "Todas" || a.entity === entity);

  function exportCsv() {
    const rows = [
      ["data", "autor", "papel", "ação", "entidade", "id", "antes", "depois", "motivo"],
      ...list.map((a) => [
        a.at,
        a.actor,
        a.actorRole,
        a.action,
        a.entity,
        a.entityId,
        a.before ?? "",
        a.after ?? "",
        a.reason ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria-grupo-geos.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        icon={ScrollText}
        title="Auditoria"
        subtitle="Registro somente-inserção: quem fez, quando, o que mudou"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          aria-label="Filtrar por entidade"
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          {entities.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          <Download className="size-4" /> Exportar CSV
        </button>
        <span className="text-xs text-muted-foreground">{list.length} registro(s)</span>
      </div>

      <ul className="space-y-2">
        {list.map((a) => (
          <li key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{a.action}</span>
              <span className="flex items-center gap-2">
                <StatusBadge tone="neutral">{a.entity}</StatusBadge>
                <StatusBadge tone="brand">{auditableRoleLabel[a.actorRole]}</StatusBadge>
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {a.actor} · {formatDateTime(a.at)} · {a.entity} {a.entityId}
            </p>
            {a.before || a.after ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {a.before ?? "—"} → <span className="text-foreground">{a.after ?? "—"}</span>
              </p>
            ) : null}
            {a.reason ? (
              <p className="mt-1 text-xs text-muted-foreground">Motivo: {a.reason}</p>
            ) : null}
          </li>
        ))}
        {list.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma ação registrada ainda. Movimente uma tarefa ou envie uma evidência para começar
            a trilha.
          </li>
        ) : null}
      </ul>
    </>
  );
}
