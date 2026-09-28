// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { LeadCard } from "@/components/team/LeadCard";
import { MemberCard } from "@/components/team/MemberCard";
import { ContactDialog } from "@/components/team/ContactDialog";
import { InstitutionalBanner } from "@/components/team/InstitutionalBanner";
import { ProgressSummary } from "@/components/timeline/ProgressSummary";
import { LatestUpdates } from "@/components/timeline/LatestUpdates";
import { TimelineFilters } from "@/components/timeline/TimelineFilters";
import { TimelineList } from "@/components/timeline/TimelineList";
import { TimelineEventRow } from "@/components/timeline/TimelineEventRow";
import type { TeamMember, TimelineEvent } from "@/data/types";

const geron: TeamMember = {
  id: "gerson",
  name: "Gérson",
  role: "CSO",
  area: "Geociências e Tecnologia",
  tier: "lead",
  badge: "crown",
  fronts: ["Visão", "Pesquisa", "Inovação", "Direção do Projeto"],
  signature: "CIÊNCIA / INOVAÇÃO / RESULTADOS",
  bio: "Lidera a pesquisa e a visão estratégica do projeto.",
  channels: [{ type: "whatsapp", label: "WhatsApp", value: "+55 (11) 99999-8888" }],
};

const camila: TeamMember = {
  id: "camila",
  name: "Camila",
  role: "CPO",
  area: "Entregas e Relacionamento",
  tier: "secondary",
  primaryContact: true,
  badge: "star",
  fronts: ["Cliente", "Acompanhamento", "Entregas"],
  signature: "PROJETOS / RELACIONAMENTO / CONQUISTAS",
  bio: "Cuida do relacionamento com o cliente e das entregas.",
  channels: [{ type: "email", label: "E-mail", value: "camilatavaresbarcelos@gmail.com" }],
};

const semCanal: TeamMember = { ...camila, id: "m1", name: "Membro", tier: "member", channels: [] };

function ev(partial: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: "e1",
    kind: "entrega",
    title: "Entrega do relatório",
    description: "Relatório consolidado enviado.",
    author: "Gérson",
    date: "2026-09-10T10:00:00.000Z",
    status: "aprovado",
    attachments: [
      { id: "a1", name: "relatorio-final.pdf", mime: "application/pdf", size: 2097152, url: "/files/relatorio-final.pdf" },
    ],
    comments: [{ id: "c1", author: "Camila", date: "2026-09-11T09:00:00.000Z", text: "Aprovado." }],
    ...partial,
  };
}

describe("Equipe — LeadCard (TDD 1-3)", () => {
  it("renderiza Gérson como lead primário com selo de liderança e frentes", () => {
    render(<LeadCard member={geron} />);
    expect(screen.getByText("Gérson")).toBeInTheDocument();
    expect(screen.getByText("CSO")).toBeInTheDocument();
    expect(screen.getByText("LIDERANÇA ESTRATÉGICA")).toBeInTheDocument();
    expect(screen.getByText("Visão • Pesquisa • Inovação • Direção do Projeto")).toBeInTheDocument();
    expect(screen.getByText("CIÊNCIA / INOVAÇÃO / RESULTADOS")).toBeInTheDocument();
  });

  it("renderiza canal real apenas (wa.me com código do país)", async () => {
    const user = userEvent.setup();
    render(<LeadCard member={geron} />);
    await user.click(screen.getByRole("button", { name: /Falar com o Gérson/i }));
    const link = await screen.findByRole("link", { name: /WhatsApp de Gérson/i });
    expect(link.getAttribute("href")).toContain("https://wa.me/5511999998888");
  });

  it("Camila aparece como secundária com selo de responsável pelo projeto", () => {
    render(<LeadCard member={camila} secondary className="lg:col-span-1" />);
    expect(screen.getByText("Camila")).toBeInTheDocument();
    expect(screen.getByText("CPO")).toBeInTheDocument();
    expect(screen.getByText("RESPONSÁVEL PELO PROJETO")).toBeInTheDocument();
    expect(screen.getByText("PROJETOS / RELACIONAMENTO / CONQUISTAS")).toBeInTheDocument();
  });

  it("card primário usa col-span-2 (maior destaque)", () => {
    render(<LeadCard member={geron} className="lg:col-span-2" />);
    expect(screen.getByText("Gérson").closest(".lg\\:col-span-2")).not.toBeNull();
  });
});

describe("Equipe — MemberCard (TDD 3, 6)", () => {
  it("renderiza card simples de membro", () => {
    render(<MemberCard member={semCanal} />);
    expect(screen.getByText("Membro")).toBeInTheDocument();
    expect(screen.getByText("Entregas e Relacionamento")).toBeInTheDocument();
  });

  it("botão de contato fica desabilitado quando o membro não tem canais (RNF07)", () => {
    render(<MemberCard member={semCanal} />);
    const btn = screen.getByRole("button", { name: /Falar com Membro/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Contato ainda não disponível");
  });
});

describe("Equipe — ContactDialog (TDD 4-5)", () => {
  it("abre o diálogo e mostra apenas canais reais", async () => {
    const user = userEvent.setup();
    render(<ContactDialog member={camila} />);
    await user.click(screen.getByRole("button", { name: /Falar com a Camila/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    const email = screen.getByLabelText("E-mail de Camila");
    expect(email.getAttribute("href")).toContain("mailto:camilatavaresbarcelos@gmail.com");
  });

  it("fecha ao clicar em Fechar", async () => {
    const user = userEvent.setup();
    render(<ContactDialog member={camila} />);
    await user.click(screen.getByRole("button", { name: /Falar com a Camila/i }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /Fechar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Equipe — InstitutionalBanner", () => {
  it("exibe a faixa institucional da equipe", () => {
    render(<InstitutionalBanner />);
    expect(screen.getByText("Uma equipe multidisciplinar, focada no seu sucesso.")).toBeInTheDocument();
    expect(screen.getByText("Mais que um projeto. Uma parceria para o futuro.")).toBeInTheDocument();
  });
});

describe("Timeline — ProgressSummary (TDD 8)", () => {
  it("calcula e mostra resumo da evolução a partir dos dados", () => {
    const events = [ev({ status: "aprovado" }), ev({ status: "aprovado" }), ev({ status: "em_andamento" })];
    render(<ProgressSummary events={events} />);
    expect(screen.getByText("Resumo da evolução")).toBeInTheDocument();
    expect(screen.getByText("Aprovado: 2")).toBeInTheDocument();
    expect(screen.getByText("Em andamento: 1")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("Entregas aprovadas")).toBeInTheDocument();
    expect(screen.getByText("Marcos concluídos")).toBeInTheDocument();
  });
});

describe("Timeline — LatestUpdates (TDD 9)", () => {
  it("exibe as atualizações mais recentes com autor, data e atalho", () => {
    const events = [ev({ title: "Entrega do relatório" }), ev({ id: "e2", title: "Aprovação do escopo" })];
    render(<LatestUpdates events={events} />);
    expect(screen.getByText("Entrega do relatório")).toBeInTheDocument();
    expect(screen.getByText("Aprovação do escopo")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Ver na linha do tempo/i }).length).toBe(2);
  });
});

describe("Timeline — Evento (TDD 10-11)", () => {
  it("lista anexos com nome, tipo e tamanho", () => {
    const event = ev({});
    render(<TimelineEventRow event={event} />);
    const link = screen.getByRole("link", { name: /relatorio-final\.pdf/i });
    expect(link).toHaveAttribute("href", "/files/relatorio-final.pdf");
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
  });

  it("mostra comentários recolhidos e expande ao clicar", async () => {
    const user = userEvent.setup();
    render(<TimelineEventRow event={ev({})} />);
    const trigger = screen.getByRole("button", { name: /Comentários \(1\)/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    expect(await screen.findByText("Aprovado.")).toBeInTheDocument();
  });

  it("registra quem aprovou e quando (aprovação)", () => {
    const event = ev({
      kind: "aprovacao",
      status: "aprovado",
      approvedBy: "Camila",
      approvedAt: "2026-09-12T00:00:00.000Z",
    });
    render(<TimelineEventRow event={event} />);
    expect(screen.getByText(/Aprovado por Camila em 12\/09\/2026/i)).toBeInTheDocument();
  });

  it("carrega âncora id para o atalho da timeline", () => {
    render(<TimelineEventRow event={ev({})} />);
    expect(screen.getByText("Entrega do relatório").closest("article")?.id).toBe("evento-e1");
  });
});

describe("Timeline — Lista e filtros (TDD 12-19)", () => {
  const events = [
    ev({ id: "e1", title: "Entrega", date: "2026-09-10T00:00:00.000Z", kind: "entrega" }),
    ev({ id: "e2", title: "Decisão", date: "2026-08-02T00:00:00.000Z", kind: "decisao", author: "Camila" }),
    ev({ id: "e3", title: "Marco", date: "2026-08-15T00:00:00.000Z", kind: "marco", status: "em_andamento", author: "Gérson" }),
  ];

  it("agrupa e ordena por mês (do mais recente ao mais antigo)", () => {
    render(<TimelineList events={events} />);
    const texts = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(texts.some((t) => t?.includes("setembro de 2026"))).toBe(true);
    expect(texts.some((t) => t?.includes("agosto de 2026"))).toBe(true);
  });

  it("mostra estado vazio neutro quando não há eventos", () => {
    render(<TimelineList events={[]} />);
    expect(screen.getByText("Nenhum evento registrado ainda")).toBeInTheDocument();
  });

  it("mostra estado vazio com ação de limpar filtros quando nada combina", () => {
    const onReset = vi.fn();
    render(<TimelineList events={[]} hasActiveFilters onResetFilters={onReset} />);
    expect(screen.getByText(/Nenhum evento corresponde aos filtros selecionados/i)).toBeInTheDocument();
    awaitClick(screen.getByRole("button", { name: /Limpar filtros/i }), onReset);
  });

  it("filtros são acessíveis via teclado e filtram os eventos", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filters = { kind: "all" as const, responsible: "all" as const, onlyApproved: false };
    render(<TimelineFilters events={events} filters={filters} onChange={onChange} />);
    const kindSelect = screen.getByLabelText("Tipo de evento");
    kindSelect.focus();
    await user.selectOptions(kindSelect, "decisao");
    expect(onChange).toHaveBeenCalledWith({ ...filters, kind: "decisao" });
    const approved = screen.getByRole("button", { name: /Somente aprovados/i });
    await user.click(approved);
    expect(onChange).toHaveBeenCalledWith({ ...filters, onlyApproved: true });
    const todos = screen.getByRole("button", { name: /Todos/i });
    await user.click(todos);
    expect(onChange).toHaveBeenCalledWith({ ...filters, onlyApproved: false });
  });

  it("toggle Somente aprovados usa aria-pressed", () => {
    const onChange = vi.fn();
    const filters = { kind: "all" as const, responsible: "all" as const, onlyApproved: true };
    render(<TimelineFilters events={events} filters={filters} onChange={onChange} />);
    expect(screen.getByRole("button", { name: /Somente aprovados/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Limpar filtros/i })).toBeInTheDocument();
  });
});

function awaitClick(el: Element, onReset: () => void) {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(onReset).toHaveBeenCalled();
}