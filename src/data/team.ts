import type { TeamMember, TechItem } from "./types";

export const stack: TechItem[] = [
  {
    name: "TypeScript",
    category: "Linguagem",
    description: "Linguagem principal do front-end e back-end.",
  },
  { name: "React", category: "Front-end", description: "SPA moderna com SSR e build otimizado." },
  {
    name: "Node.js",
    category: "Back-end",
    description: "Runtime do servidor para APIs REST e microsserviços.",
  },
  {
    name: "PostgreSQL",
    category: "Banco de dados",
    description: "Banco relacional robusto para dados transacionais.",
  },
  { name: "Redis", category: "Cache", description: "Cache em memória para sessões e filas." },
  {
    name: "AWS",
    category: "Cloud",
    description: "EC2, RDS, S3 e CloudFront para infraestrutura escalável.",
  },
  {
    name: "Docker + K8s",
    category: "DevOps",
    description: "Containers e orquestração para deploy contínuo.",
  },
  {
    name: "GitHub Actions",
    category: "CI/CD",
    description: "CI/CD automatizado com testes e deploy em staging.",
  },
];

export const team: TeamMember[] = [
  {
    name: "Weverson Rafael",
    role: "Tech Lead",
    bio: "Desenvolvedor sênior com 10 anos de experiência, formado no Codeing, 5 anos como PO Advogado.",
    links: [
      { label: "LinkedIn", href: "https://www.linkedin.com" },
      { label: "E-mail", href: "mailto:weverson@grupogeos.com.br" },
    ],
  },
  {
    name: "Henrique Fernandes",
    role: "Tech Lead",
    bio: "Desenvolvedor sênior com 12 anos de experiência, 4 anos como tech lead. Formado no Codeing.",
    links: [
      { label: "LinkedIn", href: "https://www.linkedin.com" },
      { label: "E-mail", href: "mailto:henrique@grupogeos.com.br" },
    ],
  },
  {
    name: "Vitor Eduardo",
    role: "UX",
    bio: "Desenvolvedor pleno com 5 anos de experiência, QA e 3 anos. Formado no Codeing.",
    links: [
      { label: "LinkedIn", href: "https://www.linkedin.com" },
      { label: "E-mail", href: "mailto:vitor@grupogeos.com.br" },
    ],
  },
  {
    name: "Vinicius Galantine",
    role: "Desenvolvedor",
    bio: "Desenvolvedor sênior com 8 anos de experiência formado no Codeing. Experiência com back-end de larga escala.",
    links: [
      { label: "LinkedIn", href: "https://www.linkedin.com" },
      { label: "E-mail", href: "mailto:vinicius@grupogeos.com.br" },
    ],
  },
  {
    name: "Pedro Costa",
    role: "Head of Technology",
    bio: "Desenvolvedor com 14 anos de experiência. Experiência com gestão de esquadras e projetos. Advogado tributarista.",
    links: [
      { label: "LinkedIn", href: "https://www.linkedin.com" },
      { label: "E-mail", href: "mailto:pedro@grupogeos.com.br" },
    ],
  },
];
