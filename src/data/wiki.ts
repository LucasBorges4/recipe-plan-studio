import type { WikiArticle } from "./types";

export const wikiArticles: WikiArticle[] = [
  {
    slug: "arquitetura-geral",
    title: "Arquitetura geral do ERP",
    category: "Arquitetura",
    summary: "Visão de alto nível dos microsserviços, filas e integrações do ERP.",
    updatedAt: "10 Fev 2026",
    version: "v3",
    sections: [
      {
        heading: "Visão geral",
        body: "O ERP é composto por microsserviços independentes por domínio (fiscal, financeiro, estoque, vendas), comunicando-se por eventos assíncronos e expondo APIs REST para o front-end.",
      },
      {
        heading: "Comunicação entre serviços",
        body: "Eventos de domínio são publicados em tópicos e consumidos por serviços interessados. Chamadas síncronas são reservadas para leituras que exigem consistência imediata.",
      },
      {
        heading: "Observabilidade",
        body: "Métricas, logs estruturados e tracing distribuído são obrigatórios em todo serviço novo antes da promoção para produção.",
      },
    ],
  },
  {
    slug: "padroes-de-codigo",
    title: "Padrões de código e revisão",
    category: "Engenharia",
    summary: "Convenções de código, política de branches e checklist de code review.",
    updatedAt: "02 Fev 2026",
    version: "v5",
    sections: [
      {
        heading: "Branches e commits",
        body: "Trabalho em branches curtas a partir de main, com commits descritivos. Pull requests exigem uma aprovação técnica e CI verde.",
      },
      {
        heading: "Checklist de revisão",
        body: "Cobertura de testes para regras de negócio, tratamento de erros, ausência de dados sensíveis em logs e impacto em performance avaliado.",
      },
    ],
  },
  {
    slug: "processo-de-deploy",
    title: "Processo de deploy e rollback",
    category: "DevOps",
    summary: "Pipeline de CI/CD, janelas de deploy e procedimento de rollback.",
    updatedAt: "28 Jan 2026",
    version: "v4",
    sections: [
      {
        heading: "Pipeline",
        body: "Build, testes automatizados, análise estática e deploy automático em staging. Produção exige aprovação manual do tech lead.",
      },
      {
        heading: "Rollback",
        body: "Toda release mantém a imagem anterior disponível. O rollback é feito por reversão de tag, seguido de comunicação no Diário de Bordo.",
      },
    ],
  },
  {
    slug: "governanca-de-dados",
    title: "Governança de dados",
    category: "Governança",
    summary: "Classificação de dados, donos por domínio e regras de acesso.",
    updatedAt: "20 Jan 2026",
    version: "v2",
    sections: [
      {
        heading: "Classificação",
        body: "Dados são classificados em público, interno, confidencial e restrito. Dados pessoais são sempre no mínimo confidenciais.",
      },
      {
        heading: "Donos de domínio",
        body: "Cada domínio possui um data owner responsável por aprovar novos acessos e revisar trimestralmente os privilégios concedidos.",
      },
    ],
  },
  {
    slug: "onboarding-tecnico",
    title: "Onboarding técnico",
    category: "Engenharia",
    summary: "Passos para o primeiro dia de um novo desenvolvedor no projeto.",
    updatedAt: "12 Jan 2026",
    version: "v6",
    sections: [
      {
        heading: "Ambiente local",
        body: "Clonar os repositórios do domínio, subir dependências com Docker Compose e rodar a suíte de testes antes da primeira tarefa.",
      },
      {
        heading: "Acessos",
        body: "Acessos são solicitados pelo tech lead e concedidos com o menor privilégio necessário para a função.",
      },
    ],
  },
];

export const wikiCategories = Array.from(new Set(wikiArticles.map((a) => a.category)));
