import type { TechItem, TeamMember } from "./types";
import type { Role } from "@/lib/rbac";

export const stack: TechItem[] = [];

/**
 * Mapeamento cargo organizacional → role RBAC.
 *
 * Regras de atribuição (princípio do menor privilégio):
 * - Presidente / Diretora Executiva → diretor (aprovam, revisam, governam)
 * - Gerentes → gestor (criam/movem/aprovam tarefas do seu domínio)
 * - Supervisor → desenvolvedor (executa, reporta, comenta)
 *
 * O admin do portal ajusta no cadastro do utilizador; esta tabela é a
 * sugestão padrão ao atrelar uma conta a um membro da equipe (RNF13).
 */
export const teamRoleMap: Record<string, Role> = {
  gerson: "diretor",
  camila: "diretor",
  "daniel-melo": "desenvolvedor",
  "ana-soares": "gestor",
  tome: "gestor",
  arthur: "gestor",
  "michael-barbosa": "gestor",
  "lucas-borges": "gestor",
};

/** Equipe fixa do projeto. Emails sincronizados com o portal (RNF13). */
export const teamMembers: TeamMember[] = [
  {
    id: "gerson",
    group: "projeto",
    name: "Gérson Santos",
    role: "Presidente Científico e Estratégico",
    area: "Geociências e Tecnologia",
    tier: "lead",
    badge: "crown",
    fronts: ["Visão", "Pesquisa", "Inovação", "Direção"],
    signature: "CIÊNCIA / INOVAÇÃO / RESULTADOS",
    bio: "Lidera a pesquisa e a visão estratégica do projeto, conduzindo as soluções científicas em geotecnologias e coordenando os caminhos que transformam dados em resultados.",
    email: "gerson@gwg.com",
    channels: [],
  },
  {
    id: "camila",
    group: "projeto",
    name: "Camila Barcelos",
    role: "Diretora Executiva Geral",
    area: "Entregas e Relacionamento",
    tier: "secondary",
    badge: "star",
    primaryContact: true,
    fronts: ["Cliente", "Acompanhamento", "Entregas"],
    signature: "PROJETOS / RELACIONAMENTO / CONQUISTAS",
    bio: "Cuida do relacionamento com o cliente e do acompanhamento do projeto, organizando as entregas para que cada etapa avance no ritmo e na qualidade combinados.",
    email: "camilatavaresbarcelos@gmail.com",
    channels: [],
  },
  {
    id: "daniel-melo",
    group: "projeto",
    name: "Daniel Melo",
    role: "Supervisor de Tecnologia e Design",
    area: "Engenharia",
    tier: "member",
    photo: "/team/daniel-melo.png",
    email: "daniel.melo@gwg.com",
    channels: [],
  },
  {
    id: "ana-soares",
    group: "projeto",
    name: "Ana Soares",
    role: "Gerente de Marca e Comunicação Estratégica",
    area: "Geociências",
    tier: "member",
    photo: "/team/ana-soares.png",
    email: "ana.soares@gwg.com",
    channels: [],
  },
  {
    id: "tome",
    group: "projeto",
    name: "Tomé Melo",
    role: "Gerente de Inovação, Automação e Robótica",
    area: "Dados",
    tier: "member",
    photo: "/team/tome-melo.png",
    email: "tome@gwg.com",
    channels: [],
  },
  {
    id: "arthur",
    group: "projeto",
    name: "Arthur Senra",
    role: "Gerente de Infraestrutura e Suporte Técnico",
    area: "Engenharia",
    tier: "member",
    photo: "/team/arthur-senra.png",
    email: "arthur.henriquesenra@gmail.com",
    channels: [],
  },
  {
    id: "michael-barbosa",
    group: "projeto",
    name: "Michael Barbosa",
    role: "Gerente de Operações Técnicas",
    area: "Engenharia",
    tier: "member",
    photo: "/team/michael-barbosa.png",
    email: "michael.bergsten1993@hotmail.com",
    channels: [],
  },
  {
    id: "lucas-borges",
    group: "projeto",
    name: "Lucas Borges",
    role: "Gerente de Tecnologia e Soluções Digitais",
    area: "Tecnologia",
    tier: "member",
    photo: "/team/lucas-borges.png",
    email: "lucas.borges@gwg.com",
    channels: [],
  },
];