import type { LegalDoc } from "./types";

export const termsDoc: LegalDoc = {
  title: "Termos de Uso",
  subtitle: "Portal de Governança Corporativa — Grupo Geos",
  updatedAt: "Fev 2026",
  version: "v1.2",
  intro:
    "Estes Termos de Uso regulam as condições gerais de uso do Portal de Governança Corporativa do Grupo Geos. A utilização do Portal implica na aceitação plena e irrestrita de todas as cláusulas e condições aqui descritas. Recomendamos a leitura atenta antes de prosseguir.",
  clauses: [
    {
      title: "Objeto",
      body: 'Estes Termos de Uso regulam o acesso e a utilização do Portal de Governança Corporativa do Grupo Geos ("Portal"), uma plataforma digital destinada à gestão integrada de processos de governança, compliance, gestão de riscos e operações de engenharia. Ao acessar o Portal, o usuário declara ter lido e concordado integralmente com os termos aqui dispostos.',
    },
    {
      title: "Acesso e Credenciais",
      body: "O acesso ao Portal é restrito a colaboradores, gestores e parceiros devidamente autorizados pelo Grupo Geos. Cada usuário receberá credenciais individuais e intransferíveis. O compartilhamento de senhas ou o uso indevido de credenciais de terceiros constitui infração grave, sujeita a sanções disciplinares e legais. O usuário é integralmente responsável por todas as ações realizadas sob suas credenciais.",
    },
    {
      title: "Propriedade Intelectual",
      body: "Todo o conteúdo do Portal — incluindo código-fonte, layout, marcas, logotipos, textos, imagens, bases de dados e documentação técnica — é de propriedade exclusiva do Grupo Geos, sendo vedada qualquer reprodução, distribuição ou engenharia reversa sem autorização expressa por escrito.",
    },
    {
      title: "Uso Aceitável",
      body: "É vedado ao usuário: (i) tentar burlar mecanismos de segurança ou controle de acesso; (ii) inserir dados falsos, ofensivos ou ilícitos; (iii) utilizar o Portal para finalidade estranha às atividades profissionais autorizadas; (iv) extrair dados em massa sem autorização formal da área de governança.",
    },
    {
      title: "Registro de Atividades",
      body: "Todas as ações executadas no Portal são registradas em trilha de auditoria, incluindo data, hora, endereço de origem e identificação do usuário. Esses registros podem ser utilizados em auditorias internas, investigações de incidentes e processos administrativos.",
    },
    {
      title: "Disponibilidade e Manutenção",
      body: "O Grupo Geos empreenderá esforços razoáveis para manter o Portal disponível, podendo suspender o serviço para manutenções programadas ou emergenciais, com comunicação prévia sempre que possível.",
    },
    {
      title: "Alterações destes Termos",
      body: "Estes Termos podem ser atualizados a qualquer momento. A versão vigente é sempre a publicada nesta página, identificada pela versão e data de última atualização. O uso continuado do Portal após a publicação implica aceitação da nova versão.",
    },
    {
      title: "Foro e Legislação Aplicável",
      body: "Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca da sede do Grupo Geos para dirimir eventuais controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.",
    },
  ],
};

export const lgpdDoc: LegalDoc = {
  title: "Política LGPD",
  subtitle: "Proteção de dados pessoais — Grupo Geos",
  updatedAt: "Fev 2026",
  version: "v1.1",
  intro:
    "Esta Política descreve como o Grupo Geos trata dados pessoais no âmbito do Portal de Governança Corporativa, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais).",
  clauses: [
    {
      title: "Dados Tratados",
      body: "São tratados dados de identificação (nome, e-mail corporativo, matrícula), dados de acesso (endereço IP, registros de login, ações no sistema) e dados profissionais (cargo, área, atribuições em tarefas e aprovações).",
    },
    {
      title: "Finalidades do Tratamento",
      body: "Os dados são tratados para autenticar usuários, controlar níveis de acesso, registrar trilhas de auditoria, gerar indicadores de governança e cumprir obrigações legais e regulatórias.",
    },
    {
      title: "Bases Legais",
      body: "O tratamento se fundamenta na execução de contrato de trabalho ou de prestação de serviços, no cumprimento de obrigação legal e regulatória e no legítimo interesse do controlador para fins de segurança da informação.",
    },
    {
      title: "Compartilhamento",
      body: "Dados podem ser compartilhados com operadores de infraestrutura em nuvem e ferramentas de auditoria contratadas, sempre sob contrato com cláusulas de proteção de dados e restrição de finalidade.",
    },
    {
      title: "Retenção e Descarte",
      body: "Registros de auditoria são retidos por 5 anos. Dados cadastrais são mantidos durante o vínculo do usuário e por período legal adicional, sendo posteriormente anonimizados ou eliminados de forma segura.",
    },
    {
      title: "Segurança da Informação",
      body: "São adotados controles de criptografia em trânsito e em repouso, autenticação de múltiplos fatores, segregação de ambientes, anonimização de bases em ambientes de teste e revisão periódica de privilégios.",
    },
    {
      title: "Direitos do Titular",
      body: "O titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade e informação sobre compartilhamentos, mediante pedido ao Encarregado de Dados.",
    },
    {
      title: "Encarregado de Dados (DPO)",
      body: "As solicitações e dúvidas relativas a esta Política devem ser encaminhadas ao Encarregado de Dados do Grupo Geos pelo canal interno de privacidade.",
    },
  ],
};
