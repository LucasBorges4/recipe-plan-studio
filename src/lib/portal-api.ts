import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { roleLabel, defaultRoleForNewUser, movePermission, userCan } from "@/lib/rbac";
import { columnToStage, stageToColumn, inferProgressFromStage, isWaitingOnClient } from "@/lib/task-stages";
import { addMonthsBR, fmtBR } from "@/lib/portal-utils";
import { buildTeamCatalog } from "@/lib/team-photos";
import type { TeamMemberLinked } from "@/lib/team-photos";
import { listTeamMembers } from "@/server/team-catalog";
import type { PublicUser } from "@/lib/rbac";
import type { DatabaseDump } from "@/server/storage";
import type { AuditEntry, JsonObject, PortalStatePayload, PublicInvite } from "@/lib/records";
import { docKinds, docKindLabel, docSchemas } from "@/lib/doc-schemas";
import type { JournalComment, JournalEntry, Priority, Task } from "@/data/types";
import { logLoginAttempt } from "@/server/login-logger";

/* ------------------------------------------------------------------ */
/* Convenção de retorno: { ok: true, data: T } | { ok: false, error }  */
/* ------------------------------------------------------------------ */

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

function errorMsg(e: unknown): string {
  if (e instanceof Error && e.name === "AuthError") return e.message;
  if (e instanceof Error) return e.message;
  return "Erro interno ao processar a solicitação.";
}

/* ------------------------------------------------------------------ */
/* Helpers de data (puro, seguro no cliente)                           */
/* ------------------------------------------------------------------ */

const BR_DATE = /^\d{2}\/\d{2}\/\d{4}$/;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------------ */
/* Acesso ao contexto server (import dinâmico, fora do bundle cliente) */
/* ------------------------------------------------------------------ */

type Ctx = Awaited<ReturnType<typeof import("@/server/context").serverCtx>> & {
  requestKey: typeof import("@/server/context").requestKey;
  isRateLimited: typeof import("@/server/context").isRateLimited;
  registerFailure: typeof import("@/server/context").registerFailure;
  clearFailures: typeof import("@/server/context").clearFailures;
  logAudit: typeof import("@/server/context").logAudit;
  newId: typeof import("@/server/context").newId;
};

async function ctx(): Promise<Ctx> {
  const c = await import("@/server/context");
  const base = await c.serverCtx();
  return {
    ...base,
    requestKey: c.requestKey,
    isRateLimited: c.isRateLimited,
    registerFailure: c.registerFailure,
    clearFailures: c.clearFailures,
    logAudit: c.logAudit,
    newId: c.newId,
  };
}

/* ------------------------------------------------------------------ */
/* 1. REGISTER                                                         */
/* ------------------------------------------------------------------ */

export function expectedRegistrationCode(): string | null {
  const v =
    (typeof process !== "undefined" && process.env
      ? (process.env["REGISTRATION_CODE"] ??
        process.env["INVITE_CODE"] ??
        process.env["CADASTRO_CODE"])
      : null) ?? null;
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

export const registerFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        name: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
        email: z.string().trim().email("E-mail inválido").max(120, "E-mail muito longo"),
        password: z
          .string()
          .trim()
          .min(8, "Senha muito curta (mínimo 8 caracteres)")
          .max(200, "Senha muito longa")
          .refine(
            (v) => /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v),
            "A senha precisa de maiúscula, minúscula, número e caractere especial.",
          ),
        jobTitle: z.string().trim().max(80, "Cargo muito longo").optional(),
        department: z.string().trim().max(80, "Departamento muito longo").optional(),
        bio: z.string().trim().max(300, "Bio muito longa").optional(),
        code: z.string().trim().max(80, "Código inválido").optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<PublicUser>> => {
    try {
      const expected = expectedRegistrationCode();
      if (expected !== null) {
        const provided = (data as { code?: string }).code?.trim() ?? "";
        if (provided !== expected) {
          return {
            ok: false,
            error: "Código de cadastro inválido. Solicite o código ao administrador.",
          };
        }
      }
      const c = await ctx();
      const email = data.email.toLowerCase().trim();
      const key = await c.requestKey("reg", email);
      if (c.isRateLimited(key)) {
        return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
      }

      if (await c.storage.getUserByEmail(email)) {
        c.registerFailure(key);
        return { ok: false, error: "E-mail já cadastrado." };
      }

      const count = await c.storage.countUsers();
      const admins = (await c.storage.listUsers()).filter((u) => u.role === "admin");
      const hasAdmin = admins.length > 0;
      // Auto-recuperação: enquanto não houver nenhum administrador,
      // o próximo cadastro torna-se admin.
      let role = !hasAdmin ? "admin" : defaultRoleForNewUser;
      let inviteHash: string | null = null;

      if (count > 0) {
        const code = (data.code ?? "").trim();
        const isRegistrationCode = expected !== null && code === expected;
        if (!code) {
          if (hasAdmin) {
            c.registerFailure(key);
            return { ok: false, error: "Cadastro apenas por convite. Informe o código secreto." };
          }
          // Sem admin no sistema e sem código → auto-heal como admin
        } else if (hasAdmin && !isRegistrationCode) {
          // Quando já existe admin, o código deve ser um convite válido
          // OU o REGISTRATION_CODE do .env (já validado acima).
          const hash = await sha256Hex(code);
          const invite = await c.storage.getInviteByHash(hash);
          if (!invite || invite.usedAt) {
            c.registerFailure(key);
            return { ok: false, error: "Código de convite inválido ou já utilizado." };
          }
          if (new Date(invite.expiresAt).getTime() < Date.now()) {
            c.registerFailure(key);
            return { ok: false, error: "Este convite expirou. Solicite um novo ao administrador." };
          }
          if (invite.email.toLowerCase() !== email) {
            c.registerFailure(key);
            return { ok: false, error: "Este convite foi emitido para outro e-mail." };
          }
          role = invite.role;
          inviteHash = invite.codeHash;
        }
        // Quando não há admin, o código de cadastro já foi validado no bloco
        // superior; ignora a checagem de convite para permitir auto-heal.
      }
      const salt = c.pw.generateSaltHex();
      const hash = await c.pw.hashPassword(data.password, c.pepper, salt);

      const userId = c.newId("u");
      const now = new Date().toISOString();
      await c.storage.insertUser({
        id: userId,
        name: data.name,
        email,
        role,
        jobTitle: data.jobTitle ?? null,
        department: data.department ?? null,
        bio: data.bio ?? null,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now,
        updatedAt: now,
        avatarUrl: null,
      });

      if (inviteHash) await c.storage.markInviteUsed(inviteHash, now, userId);

      await c.auth.createSession(c.storage, userId);
      c.clearFailures(key);

      const row = await c.storage.getUserById(userId);
      if (!row) return { ok: false, error: "Falha ao finalizar o cadastro." };

      await c.logAudit(
        c.storage,
        { id: row.id, name: row.name, role },
        {
          action: "Conta criada",
          entity: "usuário",
          entityId: row.id,
          after: `${row.name} (${roleLabel[role]})`,
        },
      );

      return { ok: true, data: c.auth.publicUser(row) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 2. LOGIN (timing-safe)                                              */
/* ------------------------------------------------------------------ */

export const loginFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        email: z.string().trim().email("E-mail inválido").max(120),
        password: z.string().trim().min(1).max(200),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<PublicUser>> => {
    try {
      const c = await ctx();
      let ip: string | null = null;
      try {
        const { getRequestIP } = await import("@tanstack/react-start/server");
        ip = getRequestIP({ xForwardedFor: true }) ?? null;
      } catch { void 0; }

      const key = await c.requestKey("login", data.email);
      if (c.isRateLimited(key)) {
        logLoginAttempt({
          ts: new Date().toISOString(),
          email: data.email,
          ip,
          outcome: "rate_limited",
        });
        return {
          ok: false,
          error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
        };
      }

      const email = data.email.toLowerCase().trim();
      const user = await c.storage.getUserByEmail(email);
      const targetHash = user?.passwordHash ?? c.pw.getDummyPasswordHash();

      let valid = false;
      let verifyError: string | null = null;
      try {
        valid = c.pw.verifyPassword(data.password, c.pepper, targetHash);
      } catch (ve) {
        verifyError = ve instanceof Error ? ve.message : String(ve);
      }

      logLoginAttempt({
        ts: new Date().toISOString(),
        email,
        ip,
        outcome: !user || !valid ? "failure" : "success",
        reason: !user ? "user_not_found" : !valid ? (verifyError ?? "invalid_password") : undefined,
        error: verifyError ?? undefined,
      });

      if (!user || !valid) {
        c.registerFailure(key);
        await c.logAudit(c.storage, null, {
          action: "Falha de autenticação",
          entity: "sessão",
          entityId: email,
          reason: verifyError ?? "Credenciais inválidas",
        });
        return { ok: false, error: "E-mail ou senha inválidos." };
      }

      await c.auth.createSession(c.storage, user.id);
      c.clearFailures(key);

      const row = await c.storage.getUserById(user.id);
      return { ok: true, data: await c.auth.publicUserWithFunctions(c.storage, row!) };
    } catch (e) {
      logLoginAttempt({
        ts: new Date().toISOString(),
        email: data.email,
        ip: null,
        outcome: "error",
        error: e instanceof Error ? e.message : String(e),
      });
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 3. LOGOUT                                                           */
/* ------------------------------------------------------------------ */

export const logoutFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      await c.auth.destroyCurrentSession(c.storage);
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

/* ------------------------------------------------------------------ */
/* 4. ME (usuário atual + modo de persistência)                       */
/* ------------------------------------------------------------------ */

export const meFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    user: PublicUser | null;
    persistent: boolean;
  }> => {
    const { getStorage, isStoragePersistent } = await import("@/server/storage");
    const auth = await import("@/server/auth");
    const storage = await getStorage();
    const row = await auth.getCurrentUser(storage);
    return {
      user: row ? await auth.publicUserWithFunctions(storage, row) : null,
      persistent: isStoragePersistent(),
    };
  },
);

/**
 * Diagnóstico de persistência — expõe o estado real do storage no runtime
 * atual (Vercel). Retorna env vars presentes, qual storage está ativo, e o
 * erro real de abertura do Postgres/Neon se houver. Use em produção para
 * depurar por que cadastro/login não persistem.
 */
export const storageDiagnosticFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const c = await ctx();
    await c.auth.requirePermission(c.storage, "admin.manage");
  } catch (e) {
    return { fatal: errorMsg(e) };
  }
  let storageMod: typeof import("@/server/storage") | null = null;
  let pgOpenError: string | null = null;
  let tursoOpenError: string | null = null;
  try {
    storageMod = await import("@/server/storage");
  } catch (e) {
    return { fatal: `Falha ao importar storage: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    const { PostgresStorage } = await import("@/server/postgres-storage");
    pgOpenError = PostgresStorage.lastOpenError;
  } catch (e) {
    pgOpenError = `falha ao importar postgres-storage: ${e instanceof Error ? e.message : String(e)}`;
  }
  try {
    const { TursoStorage } = await import("@/server/turso-storage");
    tursoOpenError = TursoStorage.lastOpenError ?? null;
  } catch (e) {
    tursoOpenError = `falha ao importar turso-storage: ${e instanceof Error ? e.message : String(e)}`;
  }

  const env: Record<string, boolean> = {};
  const envNames = [
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL",
    "TURSO_DATABASE_URL",
    "LIBSQL_URL",
    "STORAGE_REQUIRE_PERSISTENT",
  ];
  for (const n of envNames) {
    env[n] =
      typeof process !== "undefined" && process.env
        ? Boolean((process.env[n] ?? "").trim())
        : false;
  }

  let storageState: Record<string, string | number | boolean | null> = {};
  if (storageMod) {
    try {
      const storage = await storageMod.getStorage();
      storageState = {
        storageKind: storage.kind,
        activePath: storageMod.getActiveDatabasePath(),
        persistent: storageMod.isStoragePersistent(),
        initError: storageMod.getStorageInitError(),
      };
    } catch (e) {
      storageState = { initError: e instanceof Error ? e.message : String(e) };
    }
  }

  return {
    timing: new Date().toISOString(),
    runtime: typeof process !== "undefined" ? (process.env["NITRO_PRESET"] ?? "unknown") : "edge",
    env,
    postgresOpenError: pgOpenError,
    tursoOpenError,
    storage: storageState,
  };
});

/* ------------------------------------------------------------------ */
/* 5. PORTAL STATE (leitura única para o cliente)                     */
/* ------------------------------------------------------------------ */

export const getPortalStateFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PortalStatePayload> => {
    const { getStorage, isStoragePersistent, getStorageInitError } =
      await import("@/server/storage");
    const storage = await getStorage();

    let authed = false;
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      authed = true;
    } catch {
      // visitante anônimo (login/termos/lgpd) recebe apenas o subconjunto público
    }

    const [
      persistent,
      storageInitError,
      legalDocs,
      info,
    ] = await Promise.all([
      isStoragePersistent(),
      getStorageInitError(),
      storage.listLegalDocs(),
      storage.getStorageInfo().catch(() => null),
    ]);

    if (!authed) {
      return {
        persistent,
        storageInitError,
        tasks: [],
        columns: [],
        controls: [],
        comments: [],
        evidences: [],
        modules: [],
        risks: [],
        wiki: [],
        milestones: [],
        releases: [],
        journal: [],
        patentStages: [],
        techStack: [],
        nextSteps: [],
        legalDocs,
        auditCount: 0,
        docs: [],
      };
    }

    const [
      tasks,
      columns,
      controls,
      comments,
      evidences,
      modules,
      risks,
      wiki,
      milestones,
      releases,
      journal,
      patentStages,
      techStack,
      nextSteps,
      auditCount,
      docs,
    ] = await Promise.all([
      storage.listTasks(),
      storage.listColumns(),
      storage.listControls(),
      storage.listComments(),
      storage.listEvidences(),
      storage.listModules(),
      storage.listRisks(),
      storage.listWiki(),
      storage.listMilestones(),
      storage.listReleases(),
      storage.listJournalEntries(),
      storage.listPatentStages(),
      storage.listTechStack(),
      storage.listNextSteps(),
      storage.countAudit(),
      storage.listDocs(),
    ]);
    return {
      persistent,
      storagePath: info?.path ?? undefined,
      storageInitError,
      storageEnv: {
        postgresUrl: Boolean(
          typeof process !== "undefined" && process.env
            ? (process.env["POSTGRES_URL"] ?? "").trim()
            : "",
        ),
        postgresNonPooling: Boolean(
          typeof process !== "undefined" && process.env
            ? (process.env["POSTGRES_URL_NON_POOLING"] ?? "").trim()
            : "",
        ),
        tursoUrl: Boolean(
          typeof process !== "undefined" && process.env
            ? (process.env["TURSO_DATABASE_URL"] ?? "").trim()
            : "",
        ),
        databaseUrl: Boolean(
          typeof process !== "undefined" && process.env
            ? (process.env["DATABASE_URL"] ?? "").trim()
            : "",
        ),
      },
      lastBackupAt: info?.lastBackupAt ?? undefined,
      tasks,
      columns,
      controls,
      comments,
      evidences,
      modules,
      risks,
      wiki,
      milestones,
      releases,
      journal,
      patentStages,
      techStack,
      nextSteps,
      legalDocs,
      auditCount,
      docs,
    };
  },
);

/* ------------------------------------------------------------------ */
/* 6. AUDIT (lista completa — requer audit.read)                      */
/* ------------------------------------------------------------------ */

export const listAuditFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<AuditEntry[]>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "audit.read");
      return { ok: true, data: await c.storage.listAudit() };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

/* Histórico de uma tarefa (visível no diálogo da tarefa) */
export const taskHistoryFn = createServerFn({ method: "GET" })
  .validator(z.object({ taskId: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<AuditEntry[]>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const all = await c.storage.listAudit();
      return {
        ok: true,
        data: all.filter((a) => a.entity === "tarefa" && a.entityId === data.taskId),
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 7. TASKS                                                            */
/* ------------------------------------------------------------------ */

export const createTaskFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        title: z.string().trim().min(1, "Informe o título").max(120, "Título muito longo"),
        description: z.string().trim().max(500, "Descrição muito longa").default(""),
        priority: z.enum(["Alta", "Média", "Baixa"]).default("Média"),
        tags: z.array(z.string().trim().min(1).max(30)).max(8, "Muitas etiquetas").default([]),
        assignee: z.string().trim().max(80, "Responsável muito longo").optional(),
        due: z.string().regex(BR_DATE, "Data deve estar no formato dd/mm/aaaa").optional(),
        stage: z.enum(["not_started", "in_progress", "waiting_client", "review", "done"]).optional(),
        progress: z.number().int().min(0).max(100).optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "task.create");

      let columns = await c.storage.listColumns();
      if (columns.length === 0) {
        await c.storage.insertColumn("Backlog");
        columns = ["Backlog"];
      }
      const defaultColumn = columns[0] ?? "Backlog";

      const stage = data.stage ? data.stage : columnToStage(defaultColumn);
      const progress = data.progress !== undefined ? data.progress : inferProgressFromStage(stage);
      const column = data.stage ? stageToColumn(data.stage) : defaultColumn;
      const responsible = data.stage === "waiting_client" ? (data.assignee?.trim() || user.name || "") : null;
      if (data.stage === "waiting_client" && !responsible) {
        return { ok: false, error: "Defina o responsável para tarefas em 'Aguardando você'." };
      }

      const taskId = c.newId("t");
      await c.storage.insertTask({
        id: taskId,
        title: data.title,
        description: data.description,
        column,
        priority: data.priority as Priority,
        tags: data.tags,
        assignee: data.assignee?.trim() || user.name,
        stage,
        progress,
        responsible,
        waitingOnClient: isWaitingOnClient(stage),
        ...(data.due ? { due: data.due } : {}),
      });

      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Tarefa criada",
          entity: "tarefa",
          entityId: taskId,
          after: `${data.title} · ${column}`,
        },
      );

      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const moveTaskFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        taskId: z.string().min(1),
        column: z.string().min(1),
        reason: z.string().trim().max(300, "Motivo muito longo").optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const task = await c.storage.getTask(data.taskId);
      if (!task) return { ok: false, error: "Tarefa não encontrada." };

      if (task.column === data.column) return { ok: true, data: null };

      const approving = data.column === "Concluído";
      const perm = movePermission(data.column);
      const user = await c.auth.requirePermission(c.storage, perm);

      await c.storage.updateTaskColumn(data.taskId, data.column);
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: approving ? "Tarefa aprovada" : "Tarefa movida",
          entity: "tarefa",
          entityId: data.taskId,
          before: `${task.title} · ${task.column}`,
          after: `${task.title} · ${data.column}`,
          ...(data.reason ? { reason: data.reason } : {}),
        },
      );

      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const updateTaskFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        taskId: z.string().min(1),
        progress: z.number().int().min(0, "Mínimo 0").max(100, "Máximo 100"),
        responsible: z.string().trim().max(80, "Responsável muito longo"),
        due: z.string().regex(BR_DATE, "Data deve estar no formato dd/mm/aaaa").optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<Task | null>> => {
    try {
      const c = await ctx();
      const task = await c.storage.getTask(data.taskId);
      if (!task) return { ok: false, error: "Tarefa não encontrada." };

      const user = await c.auth.requirePermission(c.storage, "task.move");

      // Validação de responsável obrigatório quando stage atual é waiting_client
      if (task.stage === "waiting_client" && (!data.responsible || !data.responsible.trim())) {
        return { ok: false, error: "Defina o responsável para tarefas em 'Aguardando você'." };
      }

      const updated = await c.storage.updateTaskProgress(data.taskId, {
        progress: data.progress,
        responsible: data.responsible.trim() || null,
        ...(data.due !== undefined ? { due: data.due } : {}),
      });

      if (!updated) return { ok: false, error: "Falha ao atualizar progresso." };

      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Tarefa atualizada",
          entity: "tarefa",
          entityId: data.taskId,
          before: `progresso ${task.progress}% · responsável ${task.responsible ?? "-"}`,
          after: `progresso ${updated.progress}% · responsável ${updated.responsible ?? "-"}`,
        },
      );

      return { ok: true, data: updated };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const addCommentFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        taskId: z.string().min(1),
        body: z.string().trim().min(1, "Comentário vazio").max(1000, "Comentário muito longo"),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "task.comment");
      const task = await c.storage.getTask(data.taskId);
      if (!task) return { ok: false, error: "Tarefa não encontrada." };

      const commentId = c.newId("c");
      await c.storage.insertComment({
        id: commentId,
        taskId: data.taskId,
        authorId: user.id,
        authorName: user.name,
        at: new Date().toISOString(),
        body: data.body,
      });

      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Comentário adicionado",
          entity: "tarefa",
          entityId: data.taskId,
          after: data.body.slice(0, 140),
        },
      );

      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 8. COLUMNS                                                          */
/* ------------------------------------------------------------------ */

export const addColumnFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({ name: z.string().trim().min(2, "Nome muito curto").max(40, "Nome muito longo") })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "task.create");
      const inserted = await c.storage.insertColumn(data.name);
      if (!inserted) return { ok: false, error: "Já existe uma coluna com este nome." };

      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Coluna criada",
          entity: "coluna",
          entityId: data.name,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteColumnFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const remaining = await c.storage.listColumns();
      if (remaining.length <= 1)
        return { ok: false, error: "O quadro precisa de ao menos uma coluna." };
      if ((await c.storage.countTasksInColumn(data.name)) > 0) {
        return { ok: false, error: "Remova ou mova as tarefas antes de excluir a coluna." };
      }
      const removed = await c.storage.deleteColumn(data.name);
      if (!removed) return { ok: false, error: "Coluna não encontrada." };

      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Coluna removida",
          entity: "coluna",
          entityId: data.name,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 9. COMPLIANCE / EVIDENCES                                           */
/* ------------------------------------------------------------------ */

export const attachEvidenceFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        controlId: z.string().min(1),
        fileName: z.string().trim().min(1, "Informe o arquivo").max(160, "Nome muito longo"),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "evidence.attach");
      const control = await c.storage.getControl(data.controlId);
      if (!control) return { ok: false, error: "Controle não encontrado." };

      await c.storage.insertEvidence({
        id: c.newId("ev"),
        controlId: data.controlId,
        fileName: data.fileName,
        sentById: user.id,
        sentByName: user.name,
        at: new Date().toISOString(),
        status: "Em revisão",
      });

      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Evidência anexada",
          entity: "controle",
          entityId: data.controlId,
          after: data.fileName,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const reviewEvidenceFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        id: z.string().min(1),
        approved: z.boolean(),
        note: z.string().trim().max(300, "Observação muito longa").optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "evidence.review");
      const evidence = await c.storage.getEvidence(data.id);
      if (!evidence) return { ok: false, error: "Evidência não encontrada." };
      if (evidence.status !== "Em revisão")
        return { ok: false, error: "Esta evidência já foi revisada." };

      const newStatus = data.approved ? "Aprovada" : "Rejeitada";
      await c.storage.reviewEvidence(data.id, {
        status: newStatus,
        reviewerName: user.name,
        reviewedAt: new Date().toISOString(),
        ...(data.note ? { note: data.note } : {}),
      });

      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Evidência avaliada",
          entity: "evidência",
          entityId: data.id,
          before: evidence.status,
          after: newStatus,
          ...(data.note ? { reason: data.note } : {}),
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const reviewControlFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "evidence.review");
      const control = await c.storage.getControl(data.id);
      if (!control) return { ok: false, error: "Controle não encontrado." };

      const today = new Date();
      const lastReview = fmtBR(today);
      const nextReview = fmtBR(addMonthsBR(today, 6));

      await c.storage.reviewControl(data.id, {
        status: "Conforme",
        tone: "success",
        lastReview,
        nextReview,
        overdue: false,
      });

      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Controle revisado",
          entity: "controle",
          entityId: data.id,
          before: `${control.status} · próxima ${control.nextReview}`,
          after: `Conforme · próxima ${nextReview}`,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 10. ADMIN                                                           */
/* ------------------------------------------------------------------ */

export const listUsersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<PublicUser[]>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      const users = await c.storage.listUsers();
      return {
        ok: true,
        data: await Promise.all(users.map((u) => c.auth.publicUserWithFunctions(c.storage, u))),
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const listPublicUsersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<PublicUser[]>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const storage = c.storage;
      const { publicUser } = await import("@/server/auth");
      const users = await storage.listUsers();
      return { ok: true, data: users.map((u) => publicUser(u)) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const getPublicUserFn = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string() }).strict())
  .handler(async ({ data }): Promise<ApiResult<PublicUser>> => {
    try {
      const c = await ctx();
      const user = await c.storage.getUserById(data.userId);
      if (!user) return { ok: false, error: "Usuário não encontrado." };
      return { ok: true, data: await c.auth.publicUserWithFunctions(c.storage, user) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listRoleFunctionsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    ApiResult<Array<{ role: string; functionKey: string; description: string }>>
  > => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const rows = await c.storage.listAllRoleFunctions();
      return {
        ok: true,
        data: rows.map((r) => ({
          role: r.role,
          functionKey: r.functionKey,
          description: r.description,
        })),
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const setUserRoleFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        userId: z.string().min(1),
        role: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor", "visualizador", "cliente"]),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const actor = await c.auth.requirePermission(c.storage, "admin.manage");
      const target = await c.storage.getUserById(data.userId);
      if (!target) return { ok: false, error: "Usuário não encontrado." };
      if (target.role === data.role) return { ok: true, data: null };

      if (target.role === "admin" && data.role !== "admin") {
        const admins = (await c.storage.listUsers()).filter((u) => u.role === "admin");
        if (admins.length <= 1) {
          return { ok: false, error: "O portal precisa manter pelo menos um administrador." };
        }
      }

      await c.storage.updateUser(data.userId, { role: data.role });
      await c.logAudit(
        c.storage,
        { id: actor.id, name: actor.name, role: actor.role },
        {
          action: "Papel alterado",
          entity: "usuário",
          entityId: data.userId,
          before: roleLabel[target.role],
          after: roleLabel[data.role],
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 10b. FUNÇÕES POR USUÁRIO (admin concede funções individuais)        */
/* ------------------------------------------------------------------ */

/** Catálogo de funções concedíveis, na ordem dos perfis (fonte: rbac). */
export const grantUserFunctionFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        userId: z.string().min(1),
        functionKey: z.string().trim().min(2).max(60),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const actor = await c.auth.requirePermission(c.storage, "admin.manage");
      const target = await c.storage.getUserById(data.userId);
      if (!target) return { ok: false, error: "Usuário não encontrado." };

      const { roleFunctionsData } = await import("@/lib/rbac");
      const func = Object.values(roleFunctionsData)
        .flat()
        .find((f) => f.key === data.functionKey);
      if (!func) return { ok: false, error: "Função desconhecida." };

      const granted = await c.storage.grantUserFunction(
        data.userId,
        func.key,
        func.description,
        actor.id,
      );
      if (!granted) return { ok: false, error: "Função já concedida a este usuário." };

      await c.logAudit(
        c.storage,
        { id: actor.id, name: actor.name, role: actor.role },
        {
          action: "Função concedida",
          entity: "usuário",
          entityId: data.userId,
          after: `${target.name} (${data.functionKey})`,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const revokeUserFunctionFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        userId: z.string().min(1),
        functionKey: z.string().trim().min(2).max(60),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const actor = await c.auth.requirePermission(c.storage, "admin.manage");
      const target = await c.storage.getUserById(data.userId);
      if (!target) return { ok: false, error: "Usuário não encontrado." };

      const revoked = await c.storage.revokeUserFunction(data.userId, data.functionKey);
      if (!revoked) return { ok: false, error: "Esta função não está concedida." };

      await c.logAudit(
        c.storage,
        { id: actor.id, name: actor.name, role: actor.role },
        {
          action: "Função revogada",
          entity: "usuário",
          entityId: data.userId,
          after: `${target.name} (${data.functionKey})`,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/**
 * Auto-recuperação de admin: qualquer usuário autenticado pode se
 * tornar administrador se nenhum admin existir no sistema.
 * O servidor rejeita se já houver ao menos um admin.
 */
export const promoteSelfFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      const admins = (await c.storage.listUsers()).filter((u) => u.role === "admin");
      if (admins.length > 0) {
        return { ok: false, error: "Já existe um administrador no sistema." };
      }
      await c.storage.updateUser(user.id, { role: "admin" });
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Auto-recuperação de admin",
          entity: "usuário",
          entityId: user.id,
          after: "admin",
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const deleteUserFn = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const actor = await c.auth.requirePermission(c.storage, "admin.manage");
      if (actor.id === data.userId)
        return { ok: false, error: "Você não pode remover a própria conta." };
      const target = await c.storage.getUserById(data.userId);
      if (!target) return { ok: false, error: "Usuário não encontrado." };

      if (target.role === "admin") {
        const admins = (await c.storage.listUsers()).filter((u) => u.role === "admin");
        if (admins.length <= 1) {
          return { ok: false, error: "O portal precisa manter pelo menos um administrador." };
        }
      }

      await c.storage.deleteUser(data.userId);
      await c.logAudit(
        c.storage,
        { id: actor.id, name: actor.name, role: actor.role },
        {
          action: "Conta removida",
          entity: "usuário",
          entityId: data.userId,
          after: `${target.name} (${target.email})`,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const addModuleFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({ name: z.string().trim().min(2, "Nome muito curto").max(60, "Nome muito longo") })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const id = c.newId("mod");
      await c.storage.insertModule({
        id,
        name: data.name,
        status: "Aguardando início",
        tone: "neutral",
        date: new Date().toISOString().slice(0, 10),
        done: 0,
        total: 0,
      });
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Módulo adicionado",
          entity: "módulo",
          entityId: id,
          after: data.name,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const removeModuleFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const removed = await c.storage.deleteModule(data.id);
      if (!removed) return { ok: false, error: "Módulo não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Módulo removido",
          entity: "módulo",
          entityId: data.id,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 11. RISKS                                                            */
/* ------------------------------------------------------------------ */

export const createRiskFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        title: z.string().trim().min(5, "Título muito curto").max(120, "Título muito longo"),
        category: z.string().trim().min(2, "Categoria obrigatória").max(40),
        owner: z.string().trim().min(2, "Responsável obrigatório").max(80),
        role: z
          .enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor", "visualizador", "cliente"])
          .optional(),
        probability: z.number().int().min(1).max(5),
        impact: z.number().int().min(1).max(5),
        mitigation: z
          .string()
          .trim()
          .min(10, "Mitigação muito curta")
          .max(500, "Mitigação muito longa"),
        status: z
          .enum(["ativo", "critico", "em_tratamento", "mitigado", "pendente_cliente"])
          .optional(),
        nextAction: z.string().trim().max(500).optional(),
        due: z.string().max(40).nullable().optional(),
        taskId: z.string().max(80).nullable().optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "risk.manage");
      const role = data.role ?? user.role;
      if (role !== user.role && user.role !== "admin" && user.role !== "diretor") {
        return { ok: false, error: "Seu papel só permite criar riscos para sua própria role." };
      }
      const id = c.newId("rsk");
      await c.storage.insertRisk({ id, ...data, role } as Parameters<
        typeof c.storage.insertRisk
      >[0]);
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Risco criado", entity: "risco", entityId: id, after: `${data.title} [${role}]` },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const updateRiskFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        id: z.string().min(1),
        title: z.string().trim().min(5).max(120).optional(),
        category: z.string().trim().min(2).max(40).optional(),
        owner: z.string().trim().min(2).max(80).optional(),
        role: z
          .enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor", "visualizador", "cliente"])
          .optional(),
        probability: z.number().int().min(1).max(5).optional(),
        impact: z.number().int().min(1).max(5).optional(),
        mitigation: z.string().trim().min(10).max(500).optional(),
        status: z
          .enum(["ativo", "critico", "em_tratamento", "mitigado", "pendente_cliente"])
          .optional(),
        nextAction: z.string().trim().max(500).optional(),
        due: z.string().max(40).nullable().optional(),
        taskId: z.string().max(80).nullable().optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "risk.manage");
      if (
        data.role &&
        data.role !== user.role &&
        user.role !== "admin" &&
        user.role !== "diretor"
      ) {
        return { ok: false, error: "Seu papel só permite atribuir riscos à sua própria role." };
      }
      const { id, ...rest } = data;
      const patch = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      ) as Parameters<typeof c.storage.updateRisk>[1];
      const updated = await c.storage.updateRisk(id, patch);
      if (!updated) return { ok: false, error: "Risco não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Risco atualizado", entity: "risco", entityId: id, after: updated.title },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteRiskFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "risk.manage");
      const removed = await c.storage.deleteRisk(data.id);
      if (!removed) return { ok: false, error: "Risco não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Risco removido", entity: "risco", entityId: data.id },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const generateAutoRisksFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<{ created: number }>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "risk.manage");
      const tasks = await c.storage.listTasks();
      const controls = await c.storage.listControls();
      const risks = await c.storage.listRisks();
      const existingTitles = new Set(risks.map((r) => r.title));
      const now = new Date();
      let created = 0;
      const mkRisk = async (
        title: string,
        category: string,
        mitigation: string,
        extra?: { status?: import("@/data/types").RiskStatus; nextAction?: string; due?: string | null; taskId?: string | null },
      ) => {
        if (existingTitles.has(title)) return;
        const id = c.newId("rsk");
        await c.storage.insertRisk({
          id,
          title,
          category,
          owner: user.name,
          role: user.role,
          probability: 3,
          impact: 4,
          mitigation,
          status: extra?.status ?? "ativo",
          nextAction: extra?.nextAction ?? "",
          due: extra?.due ?? null,
          taskId: extra?.taskId ?? null,
        } as Parameters<typeof c.storage.insertRisk>[0]);
        existingTitles.add(title);
        created++;
        await c.logAudit(
          c.storage,
          { id: user.id, name: user.name, role: user.role },
          { action: "Risco auto-gerado", entity: "risco", entityId: id, after: title },
        );
      };
      for (const t of tasks) {
        if (!t.due) continue;
        const due = new Date(t.due);
        if (due < now && t.column !== "Concluído") {
          await mkRisk(
            `Atraso: ${t.title}`,
            "Operacional",
            `Tarefa "${t.title}" vencida em ${t.due} na coluna ${t.column}. Verificar impedimentos.`,
            {
              status: "em_tratamento",
              nextAction: `Desbloquear tarefa "${t.title}"`,
              due: t.due,
              taskId: t.id,
            },
          );
        }
      }
      for (const ctrl of controls) {
        if (ctrl.status === "Vencido" || ctrl.overdue) {
          await mkRisk(
            `Controle vencido: ${ctrl.control}`,
            "Compliance",
            `Controle "${ctrl.control}" (${ctrl.norm}) vencido. Revisão necessária.`,
            { status: "pendente_cliente", nextAction: `Revisar controle "${ctrl.control}"` },
          );
        } else if (ctrl.nextReview) {
          const nr = new Date(ctrl.nextReview);
          if (nr < now) {
            await mkRisk(
              `Revisão pendente: ${ctrl.control}`,
              "Compliance",
              `Revisão do controle "${ctrl.control}" expirou em ${ctrl.nextReview}.`,
              { status: "pendente_cliente", nextAction: `Atualizar revisão do controle "${ctrl.control}"`, due: ctrl.nextReview },
            );
          }
        }
      }
      return { ok: true, data: { created } };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

/* ------------------------------------------------------------------ */
/* 12. WIKI                                                             */
/* ------------------------------------------------------------------ */

export const createWikiFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        slug: z
          .string()
          .trim()
          .min(3, "Slug muito curto")
          .max(60, "Slug muito longo")
          .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
        title: z.string().trim().min(5, "Título muito curto").max(120, "Título muito longo"),
        category: z.string().trim().min(2).max(40),
        summary: z.string().trim().min(10).max(300),
        version: z.string().trim().min(1).max(20).default("v1"),
        sections: z
          .array(
            z.object({
              heading: z.string().trim().min(1).max(80),
              body: z.string().trim().min(1).max(2000),
            }),
          )
          .min(1, "Ao menos uma seção")
          .max(20),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "wiki.write");
      if (await c.storage.getWiki(data.slug))
        return { ok: false, error: "Já existe um artigo com este slug." };
      await c.storage.insertWiki({
        slug: data.slug,
        title: data.title,
        category: data.category,
        summary: data.summary,
        updatedAt: fmtBR(new Date()),
        version: data.version,
        sections: data.sections,
        updatedBy: user.name,
      });
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Artigo Wiki criado", entity: "wiki", entityId: data.slug, after: data.title },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const updateWikiFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        slug: z.string().min(1),
        title: z.string().trim().min(5).max(120).optional(),
        category: z.string().trim().min(2).max(40).optional(),
        summary: z.string().trim().min(10).max(300).optional(),
        version: z.string().trim().min(1).max(20).optional(),
        sections: z
          .array(
            z.object({
              heading: z.string().trim().min(1).max(80),
              body: z.string().trim().min(1).max(2000),
            }),
          )
          .min(1)
          .max(20)
          .optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "wiki.write");
      const { slug, ...rest } = data;
      const patch = {
        ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
        updatedAt: fmtBR(new Date()),
      } as Parameters<typeof c.storage.updateWiki>[1];
      const updated = await c.storage.updateWiki(slug, patch);
      if (!updated) return { ok: false, error: "Artigo não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Artigo Wiki atualizado", entity: "wiki", entityId: slug, after: updated.title },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteWikiFn = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "wiki.delete");
      const removed = await c.storage.deleteWiki(data.slug);
      if (!removed) return { ok: false, error: "Artigo não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Artigo Wiki removido", entity: "wiki", entityId: data.slug },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 13. JOURNAL (Milestones & Releases)                                  */
/* ------------------------------------------------------------------ */

export const createMilestoneFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        date: z.string().trim().min(3).max(30),
        type: z.enum(["Entrega", "Integração", "Marco", "Decisão"]),
        title: z.string().trim().min(5).max(120),
        description: z.string().trim().min(10).max(500),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "journal.manage");
      const id = c.newId("ms");
      await c.storage.insertMilestone({ id, ...data });
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Marco criado", entity: "marco", entityId: id, after: data.title },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteMilestoneFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "journal.manage");
      const removed = await c.storage.deleteMilestone(data.id);
      if (!removed) return { ok: false, error: "Marco não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Marco removido", entity: "marco", entityId: data.id },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const createReleaseFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        version: z.string().trim().min(2).max(20),
        date: z.string().trim().min(3).max(30),
        items: z.array(z.string().trim().min(2).max(120)).min(1).max(10),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "journal.manage");
      await c.storage.insertRelease(data);
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Release criada",
          entity: "release",
          entityId: data.version,
          after: data.version,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteReleaseFn = createServerFn({ method: "POST" })
  .validator(z.object({ version: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "journal.manage");
      const removed = await c.storage.deleteRelease(data.version);
      if (!removed) return { ok: false, error: "Release não encontrada." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Release removida", entity: "release", entityId: data.version },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listJournalEntriesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<JournalEntry[]>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      return { ok: true, data: await c.storage.listJournalEntries() };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const createJournalEntryFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        id: z.string().min(1).optional(),
        type: z.enum(["Entrega", "Integração", "Marco", "Decisão", "Aprovação", "Atualização"]),
        title: z.string().trim().min(1, "Título obrigatório").max(120, "Título muito longo"),
        description: z.string().trim().min(1, "Descrição obrigatória").max(500, "Descrição muito longa"),
        occurredAt: z.string().min(3).max(30),
        status: z.enum(["Em andamento", "Entregue", "Aguardando aprovação", "Aprovado pelo cliente", "Concluído", "Requer atenção"]),
        authorId: z.string().min(1),
        authorName: z.string().trim().min(1),
        department: z.string().trim().max(80).optional(),
        comments: z.array(z.any()).optional().default([]),
        attachments: z.array(z.any()).optional().default([]),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "journal.manage");
      const entryId = data.id ?? c.newId("j");
      await c.storage.insertJournalEntry({
        id: entryId,
        type: data.type,
        title: data.title,
        description: data.description,
        occurredAt: data.occurredAt,
        status: data.status,
        authorId: user.id,
        authorName: user.name,
        department: data.department ?? null,
        comments: (data.comments ?? []) as JournalComment[],
        attachments: (data.attachments ?? []) as import("@/data/types").JournalAttachment[],
      } as JournalEntry);
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Atualização do diário criada", entity: "journal", entityId: entryId, after: data.title },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const updateJournalEntryFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(500).optional(),
        status: z.enum(["Em andamento", "Entregue", "Aguardando aprovação", "Aprovado pelo cliente", "Concluído", "Requer atenção"]).optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<boolean>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "journal.manage");
      const entries = await c.storage.listJournalEntries();
      const entry = entries.find((e) => e.id === data.id);
      if (!entry) return { ok: false, error: "Registro não encontrado." };
      const updated = { ...entry, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null)) } as JournalEntry;
      const ok = await c.storage.updateJournalEntry(updated);
      if (!ok) return { ok: false, error: "Falha ao atualizar." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Atualização do diário atualizada", entity: "journal", entityId: data.id, after: updated.title },
      );
      return { ok: true, data: true };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteJournalEntryFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "journal.manage");
      const removed = await c.storage.deleteJournalEntry(data.id);
      if (!removed) return { ok: false, error: "Registro não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Atualização do diário removida", entity: "journal", entityId: data.id },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const addJournalCommentFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        entryId: z.string().min(1),
        content: z.string().trim().min(1, "Comentário vazio").max(1000, "Comentário muito longo"),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      const commentId = c.newId("jc");
      const added = await c.storage.addJournalComment(data.entryId, {
        id: commentId,
        authorId: user.id,
        authorName: user.name,
        content: data.content,
        createdAt: new Date().toISOString(),
      } as JournalComment);
      if (!added) return { ok: false, error: "Registro não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Comentário adicionado ao diário", entity: "journal", entityId: data.entryId },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const editOwnCommentFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        entryId: z.string().min(1),
        commentId: z.string().min(1),
        content: z.string().trim().min(1, "Comentário vazio").max(1000, "Comentário muito longo"),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<boolean>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      const updated = await c.storage.updateOwnComment(data.entryId, data.commentId, data.content, user.id);
      if (!updated) return { ok: false, error: "Comentário não encontrado ou sem permissão." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Comentário editado no diário", entity: "journal", entityId: data.entryId },
      );
      return { ok: true, data: true };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteOwnCommentFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        entryId: z.string().min(1),
        commentId: z.string().min(1),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<boolean>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      const deleted = await c.storage.deleteOwnComment(data.entryId, data.commentId, user.id);
      if (!deleted) return { ok: false, error: "Comentário não encontrado ou sem permissão." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Comentário removido do diário", entity: "journal", entityId: data.entryId },
      );
      return { ok: true, data: true };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const approveJournalEntryFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        id: z.string().min(1),
        note: z.string().trim().max(300, "Nota muito longa").optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const user = await c.auth.getCurrentUser(c.storage);
      if (!user) return { ok: false, error: "Não autenticado." };
      const entries = await c.storage.listJournalEntries();
      const entry = entries.find((e) => e.id === data.id);
      if (!entry) return { ok: false, error: "Registro não encontrado." };
      const patch: JournalEntry = {
        ...entry,
        status: "Aprovado pelo cliente" as JournalEntry["status"],
        approvedBy: user.name,
        approvedAt: new Date().toISOString(),
        ...(data.note !== undefined ? { approvedNote: data.note } : {} as any),
      };
      const ok = await c.storage.updateJournalEntry(patch);
      if (!ok) return { ok: false, error: "Falha ao aprovar." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Atualização aprovada pelo cliente", entity: "journal", entityId: data.id, ...(data.note !== undefined ? { reason: data.note } : {}) },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 14. PATENT                                                           */
/* ------------------------------------------------------------------ */

export const updatePatentStageFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        id: z.string().min(1),
        status: z.enum(["Concluído", "Em Andamento", "Pendente", "Aguardando"]),
        deadline: z.string().trim().min(3).max(30).optional(),
        owner: z.string().trim().min(2).max(80).optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const stage = await c.storage.getPatentStage(data.id);
      if (!stage) return { ok: false, error: "Etapa não encontrada." };
      const updated = await c.storage.updatePatentStage(data.id, {
        status: data.status,
        ...(data.deadline ? { deadline: data.deadline } : {}),
        ...(data.owner ? { owner: data.owner } : {}),
      });
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Etapa de patente atualizada",
          entity: "patente",
          entityId: data.id,
          before: stage.status,
          after: data.status,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 15. PERFIS & LIMPEZA DE USUÁRIOS                                     */
/* ------------------------------------------------------------------ */

export const clearAllUsersFn = createServerFn({ method: "POST" })
  .validator(z.object({ confirm: z.literal("APAGAR_TUDO") }).strict())
  .handler(async ({ data }): Promise<ApiResult<{ deleted: number }>> => {
    try {
      const c = await ctx();
      void data;
      const count = await c.storage.countUsers();
      if (count === 0) return { ok: true, data: { deleted: 0 } };
      const me = await c.auth.getCurrentUser(c.storage);
      if (me) {
        if (!userCan(await c.auth.publicUserWithFunctions(c.storage, me), "admin.manage"))
          return { ok: false, error: "Apenas administrador pode apagar todos os usuários." };
      } else if (count > 0) {
        const admins = (await c.storage.listUsers()).filter((u) => u.role === "admin");
        if (admins.length > 0)
          return { ok: false, error: "Faça login como admin para limpar a base." };
      }
      const deleted = await c.storage.clearAllUsers();
      await c.auth.destroyCurrentSession(c.storage);
      await c.logAudit(c.storage, me ? { id: me.id, name: me.name, role: me.role } : null, {
        action: "Base de usuários zerada",
        entity: "usuário",
        entityId: "*",
        before: `${count} usuário(s)`,
        after: "0",
        reason: "Limpeza solicitada via /admin",
      });
      return { ok: true, data: { deleted } };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* Backup / restauração — admin.manage                                 */
/* ------------------------------------------------------------------ */

export type BackupSummary = {
  exportedAt: string;
  sizeKb: number;
  counts: Record<string, number>;
};

function backupCounts(dump: DatabaseDump): Record<string, number> {
  const counts: Record<string, number> = {
    usuarios: dump.users.length,
    sessoes: dump.sessions.length,
    tarefas: dump.tasks.length,
    controles: dump.controls.length,
    evidencias: dump.evidences.length,
    riscos: dump.risks.length,
    wiki: dump.wiki.length,
    modulos: dump.modules.length,
    marcos: dump.milestones.length,
    releases: dump.releases.length,
    patentes: dump.patentStages.length,
    tecnologias: dump.techStack.length,
    "proximos-passos": dump.nextSteps.length,
    "documentos-legais": dump.legalDocs.length,
    auditoria: dump.audit.length,
    "funcoes-concedidas": dump.userFunctions.length,
  };
  return counts;
}

function isDatabaseDump(payload: unknown): payload is DatabaseDump {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const d = payload as Record<string, unknown>;
  return (
    typeof d["exportedAt"] === "string" &&
    Array.isArray(d["users"]) &&
    Array.isArray(d["sessions"]) &&
    Array.isArray(d["columns"]) &&
    Array.isArray(d["tasks"]) &&
    Array.isArray(d["comments"]) &&
    Array.isArray(d["controls"]) &&
    Array.isArray(d["evidences"]) &&
    Array.isArray(d["audit"]) &&
    Array.isArray(d["modules"]) &&
    Array.isArray(d["risks"]) &&
    Array.isArray(d["wiki"]) &&
    Array.isArray(d["milestones"]) &&
    Array.isArray(d["releases"]) &&
    Array.isArray(d["patentStages"]) &&
    Array.isArray(d["techStack"]) &&
    Array.isArray(d["automationShares"]) &&
    Array.isArray(d["nextSteps"]) &&
    Array.isArray(d["legalDocs"])
  );
}

export const exportBackupFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<{ dump: DatabaseDump; summary: BackupSummary }>> => {
    try {
      const c = await ctx();
      const actor = await c.auth.requirePermission(c.storage, "admin.manage");
      const dump = await c.storage.exportDatabase();
      await c.storage.setMeta("last_backup_at", dump.exportedAt);
      await c.logAudit(
        c.storage,
        { id: actor.id, name: actor.name, role: actor.role },
        {
          action: "Backup exportado",
          entity: "banco",
          entityId: "*",
          after: dump.exportedAt,
        },
      );
      const sizeKb = Math.round(JSON.stringify(dump).length / 1024);
      return {
        ok: true,
        data: {
          dump,
          summary: { exportedAt: dump.exportedAt, sizeKb, counts: backupCounts(dump) },
        },
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const importBackupFn = createServerFn({ method: "POST" })
  .validator(z.object({ confirm: z.literal("RESTAURAR"), payload: z.unknown() }).strict())
  .handler(async ({ data }): Promise<ApiResult<{ counts: Record<string, number> }>> => {
    try {
      const c = await ctx();
      const actor = await c.auth.requirePermission(c.storage, "admin.manage");
      if (!isDatabaseDump(data.payload))
        return { ok: false, error: "Arquivo de backup inválido ou incompatível." };
      const dump = data.payload;
      await c.storage.importDatabase(dump);
      await c.storage.setMeta("last_backup_at", dump.exportedAt);
      await c.logAudit(
        c.storage,
        { id: actor.id, name: actor.name, role: actor.role },
        {
          action: "Backup restaurado",
          entity: "banco",
          entityId: "*",
          after: `${dump.users.length} usuário(s), ${dump.tasks.length} tarefa(s)`,
        },
      );
      return { ok: true, data: { counts: backupCounts(dump) } };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        jobTitle: z.string().trim().max(80).optional(),
        department: z.string().trim().max(80).optional(),
        bio: z.string().trim().max(300).optional(),
        avatarUrl: z.string().trim().max(1_500_000).nullable().optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<PublicUser>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      const patch = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined),
      ) as Partial<
        Pick<
          import("@/server/storage").UserRow,
          "name" | "jobTitle" | "department" | "bio" | "avatarUrl"
        >
      >;
      if (Object.keys(patch).length === 0)
        return { ok: false, error: "Nenhum campo para atualizar." };
      await c.storage.updateUser(user.id, patch);
      const row = await c.storage.getUserById(user.id);
      if (!row) return { ok: false, error: "Usuário não encontrado após atualização." };
      await c.logAudit(
        c.storage,
        { id: row.id, name: row.name, role: row.role },
        {
          action: "Perfil atualizado",
          entity: "usuário",
          entityId: row.id,
          after: Object.keys(patch).join(", "),
        },
      );
      return { ok: true, data: await c.auth.publicUserWithFunctions(c.storage, row) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const bootstrapClearFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<{ deleted: number }>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      const storage = c.storage;
      const count = await storage.countUsers();
      if (count === 0) return { ok: true, data: { deleted: 0 } };
      const deleted = await storage.clearAllUsers();
      return { ok: true, data: { deleted } };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const seedDemoUsersFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<{ created: number }>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      const count = await c.storage.countUsers();
      const seeds: Array<{
        name: string;
        email: string;
        password: string;
        role: import("@/lib/rbac").Role;
        jobTitle: string;
        department: string;
      }> = [
        {
          name: "Admin Geos",
          email: "admin@grupogeos.com.br",
          password: "Admin123!",
          role: "admin",
          jobTitle: "Administrador do Portal",
          department: "Governança & TI",
        },
        {
          name: "Diretoria Geos",
          email: "diretor@grupogeos.com.br",
          password: "Diretor123!",
          role: "diretor",
          jobTitle: "Diretor Executivo",
          department: "Diretoria",
        },
        {
          name: "Gestor Geos",
          email: "gestor@grupogeos.com.br",
          password: "Gestor123!",
          role: "gestor",
          jobTitle: "Gestor de Área",
          department: "Operações",
        },
        {
          name: "Dev Geos",
          email: "dev@grupogeos.com.br",
          password: "Dev123456!",
          role: "desenvolvedor",
          jobTitle: "Engenharia",
          department: "Tecnologia",
        },
        {
          name: "Auditor Geos",
          email: "auditor@grupogeos.com.br",
          password: "Auditor123!",
          role: "auditor",
          jobTitle: "Auditoria & Compliance",
          department: "Risco & Compliance",
        },
      ];
      let created = 0;
      for (const s of seeds) {
        if (await c.storage.getUserByEmail(s.email)) continue;
        const salt = c.pw.generateSaltHex();
        const hash = await c.pw.hashPassword(s.password, c.pepper, salt);
        await c.storage.insertUser({
          id: c.newId("u"),
          name: s.name,
          email: s.email.toLowerCase(),
          role: s.role,
          jobTitle: s.jobTitle,
          department: s.department,
          bio: null,
          passwordHash: hash,
          passwordSalt: salt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          avatarUrl: null,
        });
        created++;
      }
      await c.logAudit(c.storage, null, {
        action: "Seed de usuários por role",
        entity: "usuário",
        entityId: "*",
        after: `${created} criado(s)`,
      });
      return { ok: true, data: { created } };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const createUserWithRoleFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().email().max(120),
        password: z.string().trim().min(8).max(200),
        role: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor", "visualizador", "cliente"]),
        jobTitle: z.string().trim().max(80).optional(),
        department: z.string().trim().max(80).optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<PublicUser>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      const email = data.email.toLowerCase().trim();
      if (await c.storage.getUserByEmail(email))
        return { ok: false, error: "E-mail já cadastrado." };
      const salt = c.pw.generateSaltHex();
      const hash = await c.pw.hashPassword(data.password, c.pepper, salt);
      const id = c.newId("u");
      await c.storage.insertUser({
        id,
        name: data.name,
        email,
        role: data.role,
        jobTitle: data.jobTitle ?? null,
        department: data.department ?? null,
        bio: null,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        avatarUrl: null,
      });
      const row = await c.storage.getUserById(id);
      await c.logAudit(c.storage, await c.auth.requireUser(c.storage), {
        action: "Usuário criado com role",
        entity: "usuário",
        entityId: id,
        after: `${data.name} (${data.role})`,
      });
      return { ok: true, data: c.auth.publicUser(row!) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const createControlFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        control: z.string().trim().min(5).max(120),
        norm: z.enum(["LGPD", "ISO 27001", "SOX"]),
        owner: z.string().trim().min(2).max(80),
        role: z
          .enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor", "visualizador", "cliente"])
          .optional(),
        tone: z
          .enum(["success", "info", "warning", "neutral", "danger", "brand"])
          .default("warning"),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const id = c.newId("c");
      const now = fmtBR(new Date());
      const next = fmtBR(addMonthsBR(new Date(), 6));
      const role = data.role ?? user.role;
      await c.storage.insertControl({
        id,
        control: data.control,
        norm: data.norm,
        owner: data.owner,
        role,
        status: "Pendente",
        tone: data.tone,
        lastReview: now,
        nextReview: next,
      });
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Controle criado",
          entity: "controle",
          entityId: id,
          after: `${data.control} [${role}]`,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteControlFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const ok = await c.storage.deleteControl(data.id);
      if (!ok) return { ok: false, error: "Controle não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Controle removido", entity: "controle", entityId: data.id },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const createTechStackFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        name: z.string().trim().min(2).max(40),
        category: z.string().trim().min(2).max(30),
        description: z.string().trim().min(5).max(200),
        icon: z.string().trim().max(200).optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      await c.storage.insertTechStack({
        name: data.name,
        category: data.category,
        description: data.description,
        ...(data.icon ? { icon: data.icon } : {}),
      } as unknown as import("@/data/types").TechItem);
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Stack adicionada", entity: "stack", entityId: data.name, after: data.name },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteTechStackFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const ok = await c.storage.deleteTechStack(data.name);
      if (!ok) return { ok: false, error: "Stack não encontrada." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Stack removida", entity: "stack", entityId: data.name },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const getN8nInfoFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ url: string; publicUrl: string; hasApiKey: boolean }> => {
    let authed = false;
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      authed = true;
    } catch {
      // não autenticado: segue sem expor hasApiKey
    }
    const { n8nBaseUrl, n8nPublicUrl, n8nApiKey } = await import("@/server/n8n");
    let publicUrl = n8nPublicUrl();
    const base = n8nBaseUrl();
    // Auto-detecção de IP público quando N8N_PUBLIC_URL não foi configurado
    if (publicUrl === base) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 2000);
        const r = await fetch("https://api.ipify.org?format=text", { signal: controller.signal });
        clearTimeout(t);
        if (r.ok) {
          const ip = (await r.text()).trim();
          if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
            publicUrl = `https://${ip.replace(/\./g, "-")}.sslip.io`;
          }
        }
      } catch {
        // mantém fallback local
      }
    }
    return { url: base, publicUrl, hasApiKey: authed && !!n8nApiKey() };
  },
);

export const getN8nFrameHealthFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<import("@/server/n8n").FrameConnectivityHint>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const { getFrameConnectivityHint } = await import("@/server/n8n");
      const result = await getFrameConnectivityHint();
      return { ok: true, data: result };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const listN8nWorkflowsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<import("@/server/n8n").N8nWorkflow[]>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const { listN8nWorkflows } = await import("@/server/n8n");
      return { ok: true, data: await listN8nWorkflows() };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const getN8nWorkflowFn = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.coerce.number().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<import("@/server/n8n").N8nWorkflow>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const { getN8nWorkflow } = await import("@/server/n8n");
      return { ok: true, data: await getN8nWorkflow(data.id) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const createN8nWorkflowFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        name: z.string().trim().min(1).max(120),
        nodes: z.any().optional(),
        connections: z.any().optional(),
        active: z.boolean().optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<import("@/server/n8n").N8nWorkflow>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const { createN8nWorkflow, n8nApiKey } = await import("@/server/n8n");
      if (!n8nApiKey()) return { ok: false, error: "N8N_API_KEY não configurada." };
      const payload: import("@/server/n8n").N8nWorkflowCreatePayload = { name: data.name };
      if (data.nodes !== undefined) payload.nodes = data.nodes;
      if (data.connections !== undefined) payload.connections = data.connections;
      if (data.active !== undefined) payload.active = data.active;
      return { ok: true, data: await createN8nWorkflow(payload) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const updateN8nWorkflowFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        id: z.coerce.number().min(1),
        name: z.string().trim().min(1).max(120),
        nodes: z.any().optional(),
        connections: z.any().optional(),
        active: z.boolean().optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<import("@/server/n8n").N8nWorkflow>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const { updateN8nWorkflow, n8nApiKey } = await import("@/server/n8n");
      if (!n8nApiKey()) return { ok: false, error: "N8N_API_KEY não configurada." };
      const payload: import("@/server/n8n").N8nWorkflowCreatePayload = { name: data.name };
      if (data.nodes !== undefined) payload.nodes = data.nodes;
      if (data.connections !== undefined) payload.connections = data.connections;
      if (data.active !== undefined) payload.active = data.active;
      return { ok: true, data: await updateN8nWorkflow(data.id, payload) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteN8nWorkflowFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.coerce.number().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const { deleteN8nWorkflow } = await import("@/server/n8n");
      await deleteN8nWorkflow(data.id);
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listAutomationSharesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<import("@/server/storage").AutomationShare[]>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "automation.read");
      const shares = await c.storage.listAutomationShares();
      const user = await c.auth.getCurrentUser(c.storage);
      if (!user) return { ok: false, error: "Não autenticado." };
      const perm = await c.auth.publicUserWithFunctions(c.storage, user);
      const canSeeAll = userCan(perm, "automation.admin") || userCan(perm, "admin.manage");
      if (canSeeAll) return { ok: true, data: shares };
      const filtered = shares.filter(
        (s) =>
          s.ownerId === user.id ||
          (!s.isPrivate && (s.sharedRole === user.role || s.sharedRole === null)) ||
          s.sharedUserIds.includes(user.id) ||
          (!s.isPrivate && s.sharedRole === null),
      );
      return { ok: true, data: filtered };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const upsertAutomationShareFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        workflowId: z.string().min(1).max(80),
        workflowName: z.string().min(1).max(120),
        sharedRole: z
          .enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor"])
          .nullable()
          .optional(),
        sharedUserIds: z.array(z.string().min(1)).max(50).optional(),
        isPrivate: z.boolean().optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "automation.create");
      const existing = await c.storage.getAutomationShareByWorkflow(data.workflowId);
      const perm = await c.auth.publicUserWithFunctions(c.storage, user);
      if (
        existing &&
        existing.ownerId !== user.id &&
        !userCan(perm, "automation.admin") &&
        !userCan(perm, "admin.manage")
      ) {
        return { ok: false, error: "Apenas o dono ou admin pode editar este compartilhamento." };
      }
      const id = existing?.id ?? c.newId("auto");
      await c.storage.upsertAutomationShare({
        id,
        workflowId: data.workflowId,
        workflowName: data.workflowName,
        ownerId: user.id,
        ownerName: user.name,
        ownerRole: user.role,
        sharedRole: data.sharedRole ?? null,
        sharedUserIds: data.sharedUserIds ?? [],
        isPrivate: data.isPrivate ?? true,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      });
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: existing ? "Automação compartilhada atualizada" : "Automação registrada",
          entity: "automação",
          entityId: data.workflowId,
          after: data.workflowName,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteAutomationShareFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "automation.create");
      const share = await c.storage.getAutomationShare(data.id);
      if (!share) return { ok: false, error: "Automação não encontrada." };
      const perm = await c.auth.publicUserWithFunctions(c.storage, user);
      if (
        share.ownerId !== user.id &&
        !userCan(perm, "automation.admin") &&
        !userCan(perm, "admin.manage")
      ) {
        return { ok: false, error: "Sem permissão para remover." };
      }
      await c.storage.deleteAutomationShare(data.id);
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Automação removida", entity: "automação", entityId: share.workflowId },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const provisionN8nUserFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<{ n8nUrl: string; message: string }>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      const { n8nPublicUrl } = await import("@/server/n8n");
      // Fase 1: não criar usuário com senha temporária. O usuário deve usar
      // o mesmo e-mail/senha do portal no n8n (email.auth-handler.js já valida no portal).
      return {
        ok: true,
        data: {
          n8nUrl: n8nPublicUrl(),
          message: `Use seu e-mail e senha do portal para entrar no n8n (${user.email}). O acesso é criado automaticamente no primeiro login.`,
        },
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const getN8nSsoTokenFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<{ token: string; expiresAt: string }>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      const secret = (process.env["N8N_SSO_SECRET"] ?? "").trim();
      if (!secret) {
        return { ok: false, error: "SSO não configurado (N8N_SSO_SECRET vazio)." };
      }
      const { generateSsoToken } = await import("@/server/n8n");
      const token = generateSsoToken(
        { email: user.email, firstName: user.name.split(" ")[0] || "", lastName: user.name.split(" ").slice(1).join(" ") || "" },
        secret,
        5,
      );
      const payload = JSON.parse(Buffer.from(token.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"));
      return {
        ok: true,
        data: {
          token,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
        },
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const getStorageInfoFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStorage, getStorageInitError, isStoragePersistent } = await import("@/server/storage");
  const storage = await getStorage();
  const info = await storage.getStorageInfo();
  return { ...info, persistent: isStoragePersistent(), initError: getStorageInitError() };
});

export const exportDatabaseFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<import("@/server/storage").DatabaseDump>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      const dump = await c.storage.exportDatabase();
      await c.storage.setMeta("last_backup_at", new Date().toISOString());
      return { ok: true, data: dump };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const importDatabaseFn = createServerFn({ method: "POST" })
  .validator(z.object({ dump: z.any() }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      await c.storage.importDatabase(data.dump as import("@/server/storage").DatabaseDump);
      await c.storage.setMeta("last_backup_at", new Date().toISOString());
      await c.logAudit(c.storage, await c.auth.requireUser(c.storage), {
        action: "Backup restaurado",
        entity: "sistema",
        entityId: "import",
      });
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listNextStepsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<import("@/server/storage").NextStep[]>> => {
    try {
      const c = await ctx();
      return { ok: true, data: await c.storage.listNextSteps() };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const createNextStepFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        title: z.string().trim().min(3).max(120),
        due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(["pendente", "em_andamento", "concluido"]).optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const steps = await c.storage.listNextSteps();
      await c.storage.insertNextStep({
        id: c.newId("ns"),
        title: data.title,
        due: data.due,
        status: data.status ?? "pendente",
        position: steps.length,
        createdAt: new Date().toISOString(),
      });
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Próximo passo criado", entity: "next_step", entityId: data.title },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const updateNextStepFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        id: z.string().min(1),
        title: z.string().trim().min(3).max(120).optional(),
        due: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        status: z.enum(["pendente", "em_andamento", "concluido"]).optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const { id, ...rest } = data;
      const patch = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      ) as Partial<import("@/server/storage").NextStep>;
      const updated = await c.storage.updateNextStep(id, patch);
      if (!updated) return { ok: false, error: "Passo não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Próximo passo atualizado", entity: "next_step", entityId: id },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteNextStepFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const ok = await c.storage.deleteNextStep(data.id);
      if (!ok) return { ok: false, error: "Passo não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Próximo passo removido", entity: "next_step", entityId: data.id },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const reorderNextStepsFn = createServerFn({ method: "POST" })
  .validator(z.object({ orderedIds: z.array(z.string().min(1)).min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      await c.storage.reorderNextSteps(data.orderedIds);
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listLegalDocsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<import("@/server/storage").LegalDoc[]>> => {
    try {
      const c = await ctx();
      return { ok: true, data: await c.storage.listLegalDocs() };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const getLegalDocFn = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<import("@/server/storage").LegalDoc | null>> => {
    try {
      const c = await ctx();
      return { ok: true, data: await c.storage.getLegalDoc(data.slug) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listLegalDocVersionsFn = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<import("@/server/storage").LegalDoc[]>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      return { ok: true, data: await c.storage.listLegalDocVersions(data.slug) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const createLegalDocFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        slug: z.string().regex(/^[a-z0-9-]+$/),
        title: z.string().trim().min(3).max(120),
        subtitle: z.string().trim().max(200).optional().default(""),
        version: z.string().trim().min(1).max(20),
        intro: z.string().trim().max(5000).optional().default(""),
        clauses: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(120),
              body: z.string().trim().min(1).max(5000),
            }),
          )
          .min(1)
          .max(30),
        publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const id = c.newId("ld");
      const now = new Date().toISOString();
      await c.storage.insertLegalDoc({
        id,
        slug: data.slug,
        title: data.title,
        subtitle: data.subtitle ?? "",
        version: data.version,
        intro: data.intro ?? "",
        clauses: data.clauses,
        publishedAt: data.publishedAt,
        createdAt: now,
        updatedAt: now,
        createdById: user.id,
      });
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Documento legal criado",
          entity: "legal_doc",
          entityId: id,
          after: `${data.slug} ${data.version}`,
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().trim().min(8).max(200),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      const valid = await c.pw.verifyPassword(data.currentPassword, c.pepper, user.passwordHash);
      if (!valid) return { ok: false, error: "Senha atual incorreta." };
      const salt = c.pw.generateSaltHex();
      const hash = await c.pw.hashPassword(data.newPassword, c.pepper, salt);
      const row = await c.storage.getUserById(user.id);
      if (!row) return { ok: false, error: "Usuário não encontrado." };
      await c.storage.deleteSessionsForUser(user.id);
      const { updateUserPassword } = await import("@/server/passwords-helpers");
      await updateUserPassword(c.storage, user.id, hash, salt);
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Senha alterada", entity: "usuário", entityId: user.id },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const createPasswordResetFn = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<{ token: string; expiresAt: string }>> => {
    try {
      const c = await ctx();
      const actor = await c.auth.requirePermission(c.storage, "admin.manage");
      const target = await c.storage.getUserById(data.userId);
      if (!target) return { ok: false, error: "Usuário não encontrado." };
      const crypto = await import("node:crypto");
      const raw = c.newId("rst") + crypto.randomBytes(16).toString("hex");
      const tokenHash = await crypto
        .createHash("sha256")
        .update(raw)
        .digest("hex");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      await c.storage.insertResetToken({
        tokenHash,
        userId: target.id,
        createdAt: now.toISOString(),
        expiresAt,
        usedAt: null,
      });
      await c.logAudit(
        c.storage,
        { id: actor.id, name: actor.name, role: actor.role },
        { action: "Link de redefinição gerado", entity: "usuário", entityId: target.id },
      );
      return { ok: true, data: { token: raw, expiresAt } };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator(
    z.object({ token: z.string().min(8), newPassword: z.string().trim().min(8).max(200) }).strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const tokenHash = await (
        await import("node:crypto")
      )
        .createHash("sha256")
        .update(data.token)
        .digest("hex");
      const rec = await c.storage.getResetTokenByHash(tokenHash);
      if (!rec) return { ok: false, error: "Token inválido." };
      if (rec.usedAt) return { ok: false, error: "Token já usado." };
      if (new Date(rec.expiresAt).getTime() < Date.now())
        return { ok: false, error: "Token expirado." };
      const salt = c.pw.generateSaltHex();
      const hash = await c.pw.hashPassword(data.newPassword, c.pepper, salt);
      const { updateUserPassword } = await import("@/server/passwords-helpers");
      await updateUserPassword(c.storage, rec.userId, hash, salt);
      await c.storage.markResetTokenUsed(tokenHash, new Date().toISOString());
      await c.storage.deleteSessionsForUser(rec.userId);
      await c.logAudit(c.storage, null, {
        action: "Senha redefinida via token",
        entity: "usuário",
        entityId: rec.userId,
      });
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listUserSessionsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<import("@/server/storage").SessionRow[]>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      const targetId = user.id;
      const list = await c.storage.listSessionsForUser(targetId);
      return { ok: true, data: list };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const revokeAllSessionsFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requireUser(c.storage);
      await c.storage.deleteSessionsForUser(user.id);
      await c.auth.destroyCurrentSession(c.storage);
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const globalSearchFn = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().trim().min(1).max(80) }).strict())
  .handler(
    async ({
      data,
    }): Promise<
      ApiResult<{
        tasks: import("@/data/types").Task[];
        risks: import("@/data/types").Risk[];
        wiki: import("@/data/types").WikiArticle[];
        controls: import("@/data/types").ComplianceControl[];
      }>
    > => {
      try {
        const c = await ctx();
        await c.auth.requireUser(c.storage);
        const q = data.q.toLowerCase();
        const [tasks, risks, wiki, controls] = await Promise.all([
          c.storage.listTasks(),
          c.storage.listRisks(),
          c.storage.listWiki(),
          c.storage.listControls(),
        ]);
        return {
          ok: true,
          data: {
            tasks: tasks
              .filter((t) =>
                `${t.title} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(q),
              )
              .slice(0, 10),
            risks: risks
              .filter((r) => `${r.title} ${r.category} ${r.mitigation}`.toLowerCase().includes(q))
              .slice(0, 10),
            wiki: wiki
              .filter((w) => `${w.title} ${w.summary} ${w.category}`.toLowerCase().includes(q))
              .slice(0, 10),
            controls: controls
              .filter((co) => `${co.control} ${co.norm} ${co.owner}`.toLowerCase().includes(q))
              .slice(0, 10),
          },
        };
      } catch (e) {
        return { ok: false, error: errorMsg(e) };
      }
    },
  );

export const saveRecordFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        kind: z.enum(docKinds),
        id: z.string().trim().max(80).optional(),
        data: z.unknown(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "record.manage");

      const parsed = docSchemas[data.kind].safeParse(data.data);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return { ok: false, error: first ? first.message : "Dados inválidos." };
      }
      const payload = parsed.data as JsonObject;
      const label = docKindLabel[data.kind];
      const now = new Date().toISOString();

      const existing = data.id ? await c.storage.getDoc(data.id) : null;
      if (data.id && !existing) return { ok: false, error: "Registro não encontrado." };
      if (existing && existing.kind !== data.kind) {
        return { ok: false, error: "Registro não encontrado." };
      }

      const id = existing?.id ?? c.newId(data.kind);
      await c.storage.upsertDoc({
        id,
        kind: data.kind,
        data: payload,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });

      const title = String(payload["title"] ?? payload["name"] ?? payload["version"] ?? id);
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: existing ? `${label} atualizado` : `${label} criado`,
          entity: data.kind,
          entityId: id,
          ...(existing ? { before: JSON.stringify(existing.data) } : {}),
          after: title,
        },
      );

      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const deleteRecordFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1).max(80) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "record.manage");
      const existing = await c.storage.getDoc(data.id);
      if (!existing) return { ok: false, error: "Registro não encontrado." };

      await c.storage.deleteDoc(data.id);
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Registro excluído",
          entity: existing.kind,
          entityId: existing.id,
          before: JSON.stringify(existing.data),
        },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* 13. CONVITES DE CADASTRO (link + código secreto)                   */
/* ------------------------------------------------------------------ */

export const createInviteFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        email: z.string().trim().email("E-mail inválido").max(120),
        role: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor", "visualizador", "cliente"]),
        days: z.coerce.number().int().min(1).max(60).default(7),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<{ code: string; email: string }>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "invite.manage");

      const email = data.email.toLowerCase().trim();
      if (await c.storage.getUserByEmail(email)) {
        return { ok: false, error: "Já existe uma conta com este e-mail." };
      }

      // Código secreto de 160 bits em base32 legível, agrupado em blocos.
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);
      let raw = "";
      for (const b of bytes) raw += alphabet[b % alphabet.length];
      const code = (raw.match(/.{1,5}/g) ?? [raw]).join("-");

      const now = new Date();
      await c.storage.insertInvite({
        id: c.newId("inv"),
        codeHash: await sha256Hex(code),
        email,
        role: data.role,
        hint: code.slice(0, 5),
        createdBy: user.id,
        createdByName: user.name,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + data.days * 24 * 60 * 60 * 1000).toISOString(),
        usedAt: null,
        usedBy: null,
      });

      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        {
          action: "Convite emitido",
          entity: "convite",
          entityId: email,
          after: `${roleLabel[data.role]} · expira em ${data.days} dia(s)`,
        },
      );

      return { ok: true, data: { code, email } };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listInvitesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<PublicInvite[]>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "invite.manage");
      const rows = await c.storage.listInvites();
      const now = Date.now();
      return {
        ok: true,
        data: rows.map((i) => ({
          id: i.id,
          email: i.email,
          role: roleLabel[i.role],
          hint: i.hint,
          createdByName: i.createdByName,
          createdAt: i.createdAt,
          expiresAt: i.expiresAt,
          usedAt: i.usedAt,
          status: i.usedAt
            ? ("Utilizado" as const)
            : new Date(i.expiresAt).getTime() < now
              ? ("Expirado" as const)
              : ("Pendente" as const),
        })),
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const revokeInviteFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1).max(80) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "invite.manage");
      const removed = await c.storage.deleteInvite(data.id);
      if (!removed) return { ok: false, error: "Convite não encontrado." };
      await c.logAudit(
        c.storage,
        { id: user.id, name: user.name, role: user.role },
        { action: "Convite revogado", entity: "convite", entityId: data.id },
      );
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* DEBUG: diagnóstico de login (apenas admin)                           */
/* ------------------------------------------------------------------ */

export const debugLoginFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().min(1), password: z.string().min(1) }).strict())
  .handler(async ({ data }) => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      const email = data.email.toLowerCase().trim();

      const user = await c.storage.getUserByEmail(email);
      const hash = user?.passwordHash ?? null;
      const salt = user?.passwordSalt ?? null;
      const targetHash = hash ?? c.pw.getDummyPasswordHash();

      let valid = false;
      let verifyError: string | null = null;
      try {
        valid = c.pw.verifyPassword(data.password, c.pepper, targetHash);
      } catch (ve) {
        verifyError = ve instanceof Error ? ve.message : String(ve);
      }

      return {
        ok: true,
        data: {
          email,
          userFound: !!user,
          hashPresent: !!hash,
          saltPresent: !!salt,
          hashLength: hash?.length ?? 0,
          passwordValid: valid,
          verifyError,
        },
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

/* ------------------------------------------------------------------ */
/* Equipe: catálogo sincronizado e atrelagem de perfis ao login        */
/* ------------------------------------------------------------------ */

export const listTeamMembersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<TeamMemberLinked[]>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      return { ok: true, data: await listTeamMembers(c.storage) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const linkTeamProfileFn = createServerFn({ method: "POST" })
  .validator(z.object({ memberId: z.string().trim().min(1).max(128) }).strict())
  .handler(async ({ data }): Promise<ApiResult<PublicUser>> => {
    try {
      const c = await ctx();
      const me = await c.auth.requireUser(c.storage);
      const member = buildTeamCatalog().find((m) => m.id === data.memberId);
      if (!member) return { ok: false, error: "Perfil de equipe não encontrado." };
      const users = await c.storage.listUsers();
      const taken = users.find((u) => u.teamMemberId === member.id && u.id !== me.id);
      if (taken) {
        return { ok: false, error: "Este perfil de equipe já está atrelado a outra conta." };
      }
      let row = me;
      if (me.teamMemberId !== member.id) {
        await c.storage.updateUser(me.id, { teamMemberId: member.id });
        row = (await c.storage.getUserById(me.id)) ?? me;
      }
      await c.logAudit(
        c.storage,
        { id: row.id, name: row.name, role: row.role },
        {
          action: "Perfil de equipe atrelado",
          entity: "equipe",
          entityId: member.id,
          after: `${member.name} (${member.group})`,
        },
      );
      return { ok: true, data: await c.auth.publicUserWithFunctions(c.storage, row) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const unlinkTeamProfileFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<PublicUser>> => {
    try {
      const c = await ctx();
      const me = await c.auth.requireUser(c.storage);
      const previous = buildTeamCatalog().find((m) => m.id === me.teamMemberId);
      await c.storage.updateUser(me.id, { teamMemberId: null });
      const row = (await c.storage.getUserById(me.id)) ?? me;
      await c.logAudit(
        c.storage,
        { id: row.id, name: row.name, role: row.role },
        {
          action: "Perfil de equipe desatrelado",
          entity: "equipe",
          entityId: me.id,
          after: previous ? previous.name : "ninguém",
        },
      );
      return { ok: true, data: await c.auth.publicUserWithFunctions(c.storage, row) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);
