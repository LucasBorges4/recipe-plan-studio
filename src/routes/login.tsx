import { useEffect, useState } from "react";
import { z } from "zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ShieldCheck, LogIn, UserPlus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { loginFn, registerFn } from "@/lib/portal-api";
import { qk, useSession } from "@/lib/api-hooks";

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const [mode, setMode] = useState<"login" | "signup">(search.convite ? "signup" : "login");
  const [code, setCode] = useState(search.convite ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (search.convite) {
      setMode("signup");
      setCode(search.convite);
    }
    if (search.email) setEmail(search.email);
  }, [search.convite, search.email]);

  if (session?.user) {
    navigate({ to: "/" });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res =
        mode === "login"
          ? await loginFn({ data: { email, password } })
          : await registerFn({
              data: {
                name,
                email,
                password,
                jobTitle: jobTitle || undefined,
                code: code.trim() || undefined,
              },
            });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      queryClient.setQueryData(qk.session, {
        user: res.data,
        persistent: session?.persistent ?? true,
      });
      await queryClient.invalidateQueries({ queryKey: qk.portal });
      await queryClient.invalidateQueries({ queryKey: qk.audit });
      await queryClient.invalidateQueries({ queryKey: qk.users });
      toast.success(mode === "login" ? "Entrou com sucesso." : "Conta criada com sucesso.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir a operação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Portal de Governança — Grupo Geos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesso restrito. Autentique-se para continuar.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => setMode("login")}
            >
              <LogIn className="mr-2 h-4 w-4" /> Entrar
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "outline"}
              onClick={() => setMode("signup")}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Criar conta
            </Button>
          </div>

          {mode === "signup" && (
            <p className="mb-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              O cadastro é feito <strong>por convite</strong>: informe o código secreto recebido do
              administrador, válido apenas para o seu e-mail. A primeira conta do portal é criada sem
              código e torna-se <strong>Administrador</strong>.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Ana Souza"
                  required
                  minLength={2}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail corporativo</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@grupogeos.com.br"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Mínimo de 8 caracteres" : "••••••••"}
                required
                minLength={mode === "signup" ? 8 : 1}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="code">Código do convite</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ex.: A7K2M-9PQ4R-..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-[11px] text-muted-foreground">
                  Deixe em branco apenas se você está criando a primeira conta do portal.
                </p>
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="jobTitle">Cargo (opcional)</Label>
                <Input
                  id="jobTitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ex.: Gestor de Compliance"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <Separator className="my-4" />

          <p className="text-center text-xs text-muted-foreground">
            Ao acessar, você concorda com os{" "}
            <Link to="/termos" className="underline underline-offset-2 hover:text-foreground">
              Termos
            </Link>{" "}
            e a{" "}
            <Link to="/lgpd" className="underline underline-offset-2 hover:text-foreground">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Problemas de acesso? Procure o administrador de governança do Grupo Geos.
        </p>
      </div>
    </div>
  );
}

const searchSchema = z.object({
  convite: z.string().trim().max(80).optional(),
  email: z.string().trim().max(120).optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Entrar — Portal de Governança" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});
