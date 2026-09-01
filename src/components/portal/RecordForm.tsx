import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveRecordFn, deleteRecordFn } from "@/lib/portal-api";
import { qk, useSession } from "@/lib/api-hooks";
import { userCan } from "@/lib/rbac";
import { docKindLabel, type DocKind } from "@/lib/doc-schemas";

/**
 * Formulário genérico dos módulos de registro. Cada página descreve seus
 * campos e o diálogo cuida de estado, validação de envio, auditoria
 * (feita no servidor) e atualização do cache.
 */

export type FieldDef =
  | { name: string; label: string; type: "text" | "textarea"; placeholder?: string }
  | { name: string; label: string; type: "number"; min?: number; max?: number }
  | { name: string; label: string; type: "select"; options: readonly string[] }
  | { name: string; label: string; type: "list"; placeholder?: string }
  | { name: string; label: string; type: "sections" };

type Values = Record<string, unknown>;

export function useCanManageRecords() {
  const { data: session } = useSession();
  return !!session?.user && userCan(session.user, "record.manage");
}

function initialValues(fields: FieldDef[], initial?: Values): Values {
  const out: Values = {};
  for (const f of fields) {
    const existing = initial?.[f.name];
    if (f.type === "list") out[f.name] = Array.isArray(existing) ? existing.join("\n") : "";
    else if (f.type === "sections")
      out[f.name] = Array.isArray(existing) ? existing : [{ heading: "", body: "" }];
    else if (f.type === "select") out[f.name] = existing ?? f.options[0] ?? "";
    else out[f.name] = existing ?? (f.type === "number" ? 1 : "");
  }
  return out;
}

function serialize(fields: FieldDef[], values: Values): Values {
  const out: Values = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === "list") {
      out[f.name] = String(v ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (f.type === "number") {
      out[f.name] = Number(v);
    } else {
      out[f.name] = v;
    }
  }
  return out;
}

interface Section {
  heading: string;
  body: string;
}

export function RecordDialog({
  kind,
  fields,
  id,
  initial,
  triggerLabel,
  variant = "default",
}: {
  kind: DocKind;
  fields: FieldDef[];
  id?: string;
  initial?: Values;
  triggerLabel?: string;
  variant?: "default" | "icon";
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(() => initialValues(fields, initial));

  useEffect(() => {
    if (open) setValues(initialValues(fields, initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: () =>
      saveRecordFn({ data: { kind, ...(id ? { id } : {}), data: serialize(fields, values) } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: qk.portal });
      await queryClient.invalidateQueries({ queryKey: qk.audit });
      toast.success(id ? "Registro atualizado." : "Registro criado.");
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const set = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${docKindLabel[kind]}`}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            {triggerLabel ?? `Novo ${docKindLabel[kind]}`}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {id ? "Editar" : "Cadastrar"} {docKindLabel[kind]}
          </DialogTitle>
          <DialogDescription>
            Todos os campos são validados no servidor e a ação é registrada na trilha de auditoria.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={`f-${f.name}`}>{f.label}</Label>

              {f.type === "text" ? (
                <Input
                  id={`f-${f.name}`}
                  value={String(values[f.name] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                  required
                />
              ) : null}

              {f.type === "textarea" ? (
                <Textarea
                  id={`f-${f.name}`}
                  value={String(values[f.name] ?? "")}
                  placeholder={f.placeholder}
                  rows={3}
                  onChange={(e) => set(f.name, e.target.value)}
                  required
                />
              ) : null}

              {f.type === "number" ? (
                <Input
                  id={`f-${f.name}`}
                  type="number"
                  min={f.min ?? 1}
                  max={f.max ?? 5}
                  value={String(values[f.name] ?? 1)}
                  onChange={(e) => set(f.name, e.target.value)}
                  required
                />
              ) : null}

              {f.type === "select" ? (
                <select
                  id={`f-${f.name}`}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : null}

              {f.type === "list" ? (
                <>
                  <Textarea
                    id={`f-${f.name}`}
                    value={String(values[f.name] ?? "")}
                    placeholder={f.placeholder}
                    rows={4}
                    onChange={(e) => set(f.name, e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Um item por linha.</p>
                </>
              ) : null}

              {f.type === "sections" ? (
                <SectionsField
                  value={(values[f.name] as Section[]) ?? []}
                  onChange={(next) => set(f.name, next)}
                />
              ) : null}
            </div>
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionsField({
  value,
  onChange,
}: {
  value: Section[];
  onChange: (next: Section[]) => void;
}) {
  const list = value.length > 0 ? value : [{ heading: "", body: "" }];
  const patch = (i: number, part: Partial<Section>) =>
    onChange(list.map((s, idx) => (idx === i ? { ...s, ...part } : s)));

  return (
    <div className="space-y-3">
      {list.map((s, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border bg-surface p-3">
          <Input
            value={s.heading}
            placeholder="Título da seção"
            onChange={(e) => patch(i, { heading: e.target.value })}
            required
          />
          <Textarea
            value={s.body}
            placeholder="Conteúdo da seção"
            rows={3}
            onChange={(e) => patch(i, { body: e.target.value })}
            required
          />
          {list.length > 1 ? (
            <button
              type="button"
              className="text-xs text-destructive hover:underline"
              onClick={() => onChange(list.filter((_, idx) => idx !== i))}
            >
              Remover seção
            </button>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...list, { heading: "", body: "" }])}
      >
        <Plus className="mr-1.5 size-4" /> Adicionar seção
      </Button>
    </div>
  );
}

export function DeleteRecordButton({ id, label }: { id: string; label: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteRecordFn({ data: { id } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: qk.portal });
      await queryClient.invalidateQueries({ queryKey: qk.audit });
      toast.success("Registro excluído.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir."),
  });

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Excluir ${label}`}
      disabled={remove.isPending}
      onClick={() => {
        if (confirm(`Excluir "${label}"? A exclusão fica registrada na auditoria.`))
          remove.mutate();
      }}
    >
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}
