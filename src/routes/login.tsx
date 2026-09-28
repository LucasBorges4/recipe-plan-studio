import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  BarChart3,
  Database,
  Cog,
  Link2,
  Globe,
  Scale,
  ShieldCheck,
  Check,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { loginFn, registerFn } from "@/lib/portal-api";
import { qk, useSession } from "@/lib/api-hooks";
import { termsDoc, lgpdDoc } from "@/data/legal";
import type { LegalDoc } from "@/data/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [lang, setLang] = useState<"pt" | "en">("pt");
  const [activeDoc, setActiveDoc] = useState<LegalDoc | null>(null);

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
                code: code || undefined,
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
      const raw =
        err instanceof Error
          ? err.message
          : "Erro inesperado ao conectar com o servidor. Tente novamente.";
      const isNetwork =
        /fetch|NetworkError|Failed to fetch|load failed|ECONNREFUSED|ECONNRESET|net::|TypeError/i.test(raw) &&
        !/E-mail|senha|inválido|credencial/i.test(raw);
      toast.error(
        isNetwork
          ? "Falha de conexão. Verifique sua internet e tente novamente."
          : (err instanceof Error ? err.message : "Não foi possível concluir a operação."),
        isNetwork ? { duration: 6000 } : undefined,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleForgotPassword() {
    toast.info(
      "Recuperação de senha é uma funcionalidade demonstrativa neste ambiente. Entre em contato com o administrador do GWG.",
      { duration: 8000 },
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#f6f8fb] overflow-hidden">
      {/* Background decorative curves */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <svg
          className="absolute -left-16 -top-16 size-[500px] text-brand/8"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        >
          <path d="M20 100 Q80 20 140 100 T190 100" />
        </svg>
        <svg
          className="absolute -right-16 -bottom-16 size-[500px] text-brand/8 rotate-180"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        >
          <path d="M20 100 Q80 20 140 100 T190 100" />
        </svg>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[1280px] min-h-screen lg:grid lg:grid-cols-[62%_38%] lg:items-stretch">
        {/* ----- Painel Institucional (esquerda) ----- */}
        <section
          className="relative hidden lg:flex lg:flex-col lg:items-start lg:justify-between lg:p-10 lg:pb-6 overflow-hidden"
          aria-label="Apresentação institucional"
        >
          {/* Foto corporativa com overlay branco suave (mais intenso à esquerda) */}
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <img
              src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1600&q=80"
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
            />
            {/* Overlay branco suave, mais intenso à esquerda */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/50 to-white/20" />
            {/* Linhas curvas azuis finas próximas às bordas superiores/inferiores */}
            <svg
              className="absolute top-6 left-8 w-[300px] h-16 text-[#0868D7]/40"
              viewBox="0 0 300 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0 30 Q75 0 150 30 T300 30" />
            </svg>
            <svg
              className="absolute bottom-6 right-8 w-[300px] h-16 text-[#0868D7]/40 rotate-180"
              viewBox="0 0 300 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0 30 Q75 0 150 30 T300 30" />
            </svg>
          </div>

          {/* Logo */}
          <div className="relative z-10">
            <a href="/" aria-label="ZAGGO — Página inicial">
              <img
                src="/zaggo-logo.png"
                alt="ZAGGO"
                className="h-24 w-auto object-contain"
              />
            </a>
          </div>

          {/* Linha horizontal azul abaixo do logo */}
          <div className="relative z-10 mt-6 w-20 h-1 rounded-full bg-[#0868D7]" aria-hidden="true" />

          {/* Conteúdo institucional */}
          <div className="relative z-10 mt-8 max-w-xl">
            <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-[#0b1628]">
              <span className="block">Gestão inteligente</span>
              <span className="block">para</span>
              <span className="block text-[#0868D7]">resultados reais.</span>
            </h1>

            <p className="mt-5 text-base leading-relaxed text-[#5a6b7b]">
              Centralize processos, acompanhe indicadores
              <br />
              e transforme dados em decisões com uma
              <br />
              plataforma desenvolvida para a sua empresa.
            </p>

            {/* Benefícios */}
            <div className="mt-7">
              <div className="flex items-center gap-4 text-[11px] font-semibold tracking-widest uppercase text-[#0868D7]/60 mb-6">
                <span className="h-px flex-1 bg-[#0868D7]/20" />
                Benefícios
                <span className="h-px flex-1 bg-[#0868D7]/20" />
              </div>
              <ul className="grid grid-cols-2 gap-5">
                {[
                  { icon: BarChart3, title: "Gestão", desc: "Mais controle e eficiência" },
                  { icon: Database, title: "Dados", desc: "Informações que geram valor" },
                  { icon: Cog, title: "Automação", desc: "Processos mais ágeis" },
                  { icon: Link2, title: "Integração", desc: "Tudo conectado para ir mais longe" },
                ].map((b) => (
                  <li key={b.title} className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-xl bg-[#e6f0fa] p-3 text-[#0868D7]">
                      <b.icon className="size-7" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0b1628]">{b.title}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#5a6b7b]">{b.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Assinatura institucional */}
          <div className="relative z-10 mt-auto pt-4">
            <div className="w-24 h-px rounded-full bg-[#0868D7] mb-4" aria-hidden="true" />
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#0b1628] uppercase leading-snug">
              IDEIAS EM GESTÃO.
              <br />
              RESULTADOS NO SEU FUTURO.
            </p>
          </div>
        </section>

        {/* ----- Painel de Login (direita, ~38%) ----- */}
        <section
          className="flex flex-col bg-white lg:rounded-l-[32px] lg:shadow-[-20px_0_60px_-12px_rgba(8,104,215,0.12)] lg:px-14 lg:py-10 px-6 py-8 min-h-screen lg:min-h-0 lg:self-stretch"
          aria-label="Acesso ao portal"
        >
          {/* Cabeçalho do painel */}
          <div className="flex items-center justify-between">
            {/* Logo no painel (mobile/tablet visível) */}
            <a href="/" aria-label="ZAGGO — Página inicial" className="lg:hidden">
              <img
                src="/zaggo-logo.png"
                alt="ZAGGO"
                className="h-9 w-auto object-contain"
              />
            </a>
            <div className="lg:hidden" />

            {/* Seletor de idioma */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLang((l) => (l === "pt" ? "en" : "pt"))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9d6e3] px-3 py-1.5 text-xs font-semibold text-[#0b1628] hover:bg-[#f4f7fa] transition-colors"
                aria-label="Alterar idioma"
              >
                <Globe className="size-3.5 text-[#6b7b8c]" aria-hidden="true" />
                {lang === "pt" ? "PT" : "EN"}
              </button>
            </div>
          </div>

          {/* Cabeçalho de boas-vindas */}
          <div className="mt-6 lg:mt-8 max-w-md">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0b1628]">Bem-vindo(a)</h2>
            <p className="mt-2 text-sm font-normal text-[#5a6b7b]">Acesse o Portal de Gestão da ZAGGO</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-[#0b1628]">
                E-mail
              </Label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8899aa]"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={lang === "pt" ? "nome@exemplo.com.br" : "name@example.com"}
                  className="h-12 pl-10 text-sm rounded-lg border-[#c9d6e3] focus:border-[#0868D7] focus:ring-[#0868D7]/20"
                  required
                  autoComplete="email"
                />
              </div>
              {email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                <p className="text-[11px] text-[#e74c3c]">Informe um e-mail válido.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold text-[#0b1628]">
                Senha
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8899aa]"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={lang === "pt" ? "Digite sua senha" : "Enter your password"}
                  className="h-12 pl-10 pr-10 text-sm rounded-lg border-[#c9d6e3] focus:border-[#0868D7] focus:ring-[#0868D7]/20"
                  required
                  minLength={mode === "login" ? 1 : 8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8899aa] hover:text-[#0b1628]"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-bold text-[#0b1628]">
                    Nome completo
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={lang === "pt" ? "Ex.: Ana Souza" : "Ex.: Ana Souza"}
                    className="h-11 text-sm rounded-lg border-[#c9d6e3] focus:border-[#0868D7] focus:ring-[#0868D7]/20"
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jobTitle" className="text-xs font-bold text-[#0b1628]">
                    Cargo (opcional)
                  </Label>
                  <Input
                    id="jobTitle"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder={
                      lang === "pt" ? "Ex.: Gestor de Compliance" : "Ex.: Compliance Manager"
                    }
                    className="h-11 text-sm rounded-lg border-[#c9d6e3] focus:border-[#0868D7] focus:ring-[#0868D7]/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-xs font-bold text-[#0b1628]">
                    Código de cadastro *
                  </Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={
                      lang === "pt"
                        ? "Informe o código fornecido pelo admin"
                        : "Enter admin-provided code"
                    }
                    className="h-11 text-sm rounded-lg border-[#c9d6e3] focus:border-[#0868D7] focus:ring-[#0868D7]/20"
                    required
                  />
                  <p className="text-[11px] text-[#5a6b7b]">
                    {lang === "pt"
                      ? "Sem o código o cadastro é bloqueado quando REGISTRATION_CODE está configurado."
                      : "Without the code, registration is blocked when REGISTRATION_CODE is configured."}
                  </p>
                </div>
                <div className="rounded-lg border border-[#0868D7]/10 bg-[#e6f0fa]/60 p-3 text-xs text-[#5a6b7b]">
                  {lang === "pt" ? (
                    <>
                      A primeira conta criada no portal torna-se{" "}
                      <strong className="text-[#0b1628]">Administrador</strong>. As demais começam como
                      Colaborador e podem ser promovidas depois.
                    </>
                  ) : (
                    <>
                      The first account created becomes an{" "}
                      <strong className="text-[#0b1628]">Administrator</strong>. Others start as
                      Contributors and can be promoted later.
                    </>
                  )}
                </div>
              </>
            )}

            {/* Linha auxiliar */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-[#c9d6e3] text-[#0868D7] focus:ring-[#0868D7]/40"
                />
                <span className="text-[#5a6b7b]">
                  {lang === "pt" ? "Lembrar de mim" : "Remember me"}
                </span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="font-semibold text-[#0868D7] hover:text-[#064c8a] underline underline-offset-2"
              >
                {lang === "pt" ? "Esqueceu sua senha?" : "Forgot password?"}
              </button>
            </div>

            {/* Botão Entrar */}
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#0868D7] text-sm font-extrabold text-white shadow-lg shadow-[#0868D7]/20 hover:bg-[#064c8a] transition-all disabled:opacity-70"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">{lang === "pt" ? "Entrando..." : "Signing in..."}</span>
              ) : (
                <span className="flex items-center gap-2">
                  {mode === "login"
                    ? lang === "pt"
                      ? "Entrar"
                      : "Sign in"
                    : lang === "pt"
                      ? "Criar conta"
                      : "Create account"}
                  {mode === "login" && <ArrowRight className="size-4" />}
                </span>
              )}
            </Button>
          </form>

          {/* Alternância login/signup */}
          <div className="mt-6 flex gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => setMode("login")}
              className="h-9 flex-1 rounded-lg text-xs font-bold bg-[#0868D7] text-white hover:bg-[#064c8a] data-[variant=outline]:border-[#c9d6e3] data-[variant=outline]:text-[#5a6b7b]"
            >
              <LogIn className="mr-1.5 size-3.5" aria-hidden="true" />{" "}
              {lang === "pt" ? "Entrar" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "outline"}
              onClick={() => setMode("signup")}
              className="h-9 flex-1 rounded-lg text-xs font-bold bg-[#0868D7] text-white hover:bg-[#064c8a] data-[variant=outline]:border-[#c9d6e3] data-[variant=outline]:text-[#5a6b7b]"
            >
              <UserPlus className="mr-1.5 size-3.5" aria-hidden="true" />{" "}
              {lang === "pt" ? "Criar conta" : "Create account"}
            </Button>
          </div>

          {/* Termos */}
          <p className="mt-6 text-center text-[11px] text-[#8899aa]">
            {lang === "pt" ? (
              <>
                Ao acessar, você concorda com os{" "}
                <button
                  type="button"
                  onClick={() => setActiveDoc(termsDoc)}
                  className="underline underline-offset-2 hover:text-[#0868D7]"
                >
                  Termos
                </button>{" "}
                e a{" "}
                <button
                  type="button"
                  onClick={() => setActiveDoc(lgpdDoc)}
                  className="underline underline-offset-2 hover:text-[#0868D7]"
                >
                  Política de Privacidade
                </button>
                .
              </>
            ) : (
              <>
                By accessing, you agree to our{" "}
                <button
                  type="button"
                  onClick={() => setActiveDoc(termsDoc)}
                  className="underline underline-offset-2 hover:text-[#0868D7]"
                >
                  Terms
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={() => setActiveDoc(lgpdDoc)}
                  className="underline underline-offset-2 hover:text-[#0868D7]"
                >
                  Privacy Policy
                </button>
                .
              </>
            )}
          </p>

          {/* Rodapé GWG */}
          <footer className="mt-auto pt-6">
            <div className="h-px w-full bg-[#c9d6e3] mb-4" aria-hidden="true" />
            <p className="text-center text-[11px] font-medium text-[#8899aa]">
              {lang === "pt" ? (
                <>
                  Solução desenvolvida pelo{" "}
                  <span className="font-extrabold text-[#0b1628]">GWG</span> — Grupo W. Geotec
                </>
              ) : (
                <>
                  Solution developed by{" "}
                  <span className="font-extrabold text-[#0b1628]">GWG</span> — Grupo W. Geotec
                </>
              )}
            </p>
          </footer>
        </section>
      </main>

      <Dialog open={activeDoc !== null} onOpenChange={(open) => !open && setActiveDoc(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[85vh] w-[92vw] max-w-2xl gap-0 overflow-hidden p-0 rounded-2xl border border-[#c9d6e3] bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between gap-4 border-b border-[#e3ebf2] bg-[#0b1628] px-6 py-4">
            <div className="flex items-center gap-3 text-white">
              {activeDoc?.title === "Política LGPD" ? (
                <ShieldCheck className="size-5 text-[#7fb3ff]" aria-hidden="true" />
              ) : (
                <Scale className="size-5 text-[#7fb3ff]" aria-hidden="true" />
              )}
              <DialogTitle className="text-base font-bold text-white">{activeDoc?.title}</DialogTitle>
            </div>
            <span className="rounded-full border border-[#7fb3ff]/40 bg-[#7fb3ff]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#7fb3ff]">
              {activeDoc?.version}
            </span>
          </div>

          <div className="flex max-h-[calc(85vh-4.5rem)] flex-col">
            <DialogDescription className="border-b border-[#e3ebf2] px-6 py-3 text-[12px] text-[#5a6b7b]">
              Última atualização: {activeDoc?.updatedAt}
            </DialogDescription>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-[13px] leading-relaxed text-[#33455c]">{activeDoc?.intro}</p>
              <div className="mt-5 space-y-4">
                {activeDoc?.clauses.map((c, i) => (
                  <section
                    key={c.title}
                    id={`modal-clausula-${i + 1}`}
                    className="rounded-xl border border-[#e3ebf2] bg-[#f7fafc] p-4"
                  >
                    <h3 className="text-[13px] font-bold text-[#0b1628]">
                      {i + 1}. {c.title}
                    </h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5a6b7b]">{c.body}</p>
                  </section>
                ))}
              </div>
            </div>
            <div className="flex justify-end border-t border-[#e3ebf2] bg-[#f2f6fa] px-6 py-3">
              <Button
                type="button"
                onClick={() => setActiveDoc(null)}
                className="h-8 rounded-lg bg-[#0868D7] px-4 text-xs font-bold text-white hover:bg-[#064c8a]"
              >
                <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                {lang === "pt" ? "Entendi" : "Got it"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Portal de Gestão | ZAGGO" },
      { name: "description", content: "Acesse o Portal de Gestão da ZAGGO." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Portal de Gestão | ZAGGO" },
      {
        property: "og:description",
        content: "Acesse o Portal de Gestão da ZAGGO.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});
