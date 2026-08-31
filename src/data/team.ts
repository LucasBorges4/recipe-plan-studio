import type { TechItem } from "./types";

export const stack: TechItem[] = [
  { name: "TypeScript", category: "Linguagem", description: "Linguagem principal do front-end e back-end." },
  { name: "React", category: "Front-end", description: "SPA moderna com SSR e build otimizado." },
  { name: "Node.js", category: "Back-end", description: "Runtime do servidor para APIs REST e microsserviços." },
  { name: "PostgreSQL", category: "Banco de dados", description: "Banco relacional robusto para dados transacionais." },
  { name: "Redis", category: "Cache", description: "Cache em memória para sessões e filas." },
  { name: "AWS", category: "Cloud", description: "EC2, RDS, S3 e CloudFront para infraestrutura escalável." },
  { name: "Docker + K8s", category: "DevOps", description: "Containers e orquestração para deploy contínuo." },
  { name: "GitHub Actions", category: "CI/CD", description: "CI/CD automatizado com testes e deploy em staging." },
];
