import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { roleLabel, defaultRoleForNewUser, movePermission, can } from "@/lib/rbac";
import { addMonthsBR, fmtBR } from "@/lib/portal-utils";
import type { PublicUser } from "@/lib/rbac";
import type { AuditEntry, JsonObject, PortalStatePayload, PublicInvite } from "@/lib/records";
import { docKinds, docKindLabel, docSchemas } from "@/lib/doc-schemas";
import type { Priority } from "@/data/types";

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
        password: z.string().trim().min(8, "Senha muito curta").max(200, "Senha muito longa"),
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
        if (!code) {
          if (hasAdmin) {
            c.registerFailure(key);
            return { ok: false, error: "Cadastro apenas por convite. Informe o código secreto." };
          }
          // Sem admin no sistema e sem código → auto-heal como admin
        } else if (hasAdmin) {
          // Quando já existe admin, o código deve ser um convite válido.
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
      const key = await c.requestKey("login", data.email);
      if (c.isRateLimited(key)) {
        return {
          ok: false,
          error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
        };
      }

      const email = data.email.toLowerCase().trim();
      const user = await c.storage.getUserByEmail(email);
      const targetHash = user?.passwordHash ?? c.pw.getDummyPasswordHash();
      const valid = await c.pw.verifyPassword(data.password, c.pepper, targetHash);

      if (!user || !valid) {
        c.registerFailure(key);
        await c.logAudit(c.storage, null, {
          action: "Falha de autenticação",
          entity: "sessão",
          entityId: email,
          reason: "Credenciais inválidas",
        });
        return { ok: false, error: "E-mail ou senha inválidos." };
      }

      await c.auth.createSession(c.storage, user.id);
      c.clearFailures(key);

      const row = await c.storage.getUserById(user.id);
      return { ok: true, data: c.auth.publicUser(row!) };
    } catch (e) {
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
      user: row ? auth.publicUser(row) : null,
      persistent: isStoragePersistent(),
    };
  },
);

/* ------------------------------------------------------------------ */
/* 5. PORTAL STATE (leitura única para o cliente)                     */
/* ------------------------------------------------------------------ */

export const getPortalStateFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PortalStatePayload> => {
    const { getStorage, isStoragePersistent, getStorageInitError } = await import("@/server/storage");
    const storage = await getStorage();
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
      patentStages,
      techStack,
      nextSteps,
      legalDocs,
      auditCount,
      docs,
      info,
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
      storage.listPatentStages(),
      storage.listTechStack(),
      storage.listNextSteps(),
      storage.listLegalDocs(),
      storage.countAudit(),
      storage.listDocs(),
      storage.getStorageInfo().catch(() => null),
    ]);
    return {
      persistent: isStoragePersistent(),
      storagePath: info?.path ?? undefined,
      storageInitError: getStorageInitError(),
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
      const column = columns[0] ?? "Backlog";

      const taskId = c.newId("t");
      await c.storage.insertTask({
        id: taskId,
        title: data.title,
        description: data.description,
        column,
        priority: data.priority as Priority,
        tags: data.tags,
        assignee: data.assignee?.trim() || user.name,
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
        data: users.map((u) => c.auth.publicUser(u)),
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const listPublicUsersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<PublicUser[]>> => {
    try {
      const { getStorage } = await import("@/server/storage");
      const { publicUser } = await import("@/server/auth");
      const storage = await getStorage();
      const users = await storage.listUsers();
      return { ok: true, data: users.map(publicUser) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const listRoleFunctionsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<Array<{ role: string; functionKey: string; description: string }>>> => {
    try {
      const { getStorage } = await import("@/server/storage");
      const storage = await getStorage();
      const rows = await storage.listAllRoleFunctions();
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
        role: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor"]),
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

/**
 * Auto-recuperação de admin: qualquer usuário autenticado pode se
 * tornar administrador se nenhum admin existir no sistema.
 * O servidor rejeita se já houver ao menos um admin.
 */
export const promoteSelfFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<ApiResult<null>> => {
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
  });

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
        role: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor"]).optional(),
        probability: z.number().int().min(1).max(5),
        impact: z.number().int().min(1).max(5),
        mitigation: z
          .string()
          .trim()
          .min(10, "Mitigação muito curta")
          .max(500, "Mitigação muito longa"),
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
      await c.storage.insertRisk({ id, ...data, role } as Parameters<typeof c.storage.insertRisk>[0]);
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
        role: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor"]).optional(),
        probability: z.number().int().min(1).max(5).optional(),
        impact: z.number().int().min(1).max(5).optional(),
        mitigation: z.string().trim().min(10).max(500).optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "risk.manage");
      if (data.role && data.role !== user.role && user.role !== "admin" && user.role !== "diretor") {
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
      const user = await c.auth.requirePermission(c.storage, "patent.manage");
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
        if (!can(me.role, "admin.manage"))
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

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        jobTitle: z.string().trim().max(80).optional(),
        department: z.string().trim().max(80).optional(),
        bio: z.string().trim().max(300).optional(),
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
        Pick<import("@/server/storage").UserRow, "name" | "jobTitle" | "department" | "bio">
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
      return { ok: true, data: c.auth.publicUser(row) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const bootstrapClearFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ApiResult<{ deleted: number }>> => {
    try {
      const { getStorage } = await import("@/server/storage");
      const storage = await getStorage();
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
      const count = await c.storage.countUsers();
      if (count > 0) {
        const me = await c.auth.getCurrentUser(c.storage);
        if (!me || !can(me.role, "admin.manage"))
          return { ok: false, error: "Base já possui usuários — apenas admin pode semear." };
      }
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
        role: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor"]),
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
        role: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor"]).optional(),
        tone: z.enum(["success", "info", "warning", "neutral", "danger", "brand"]).default("warning"),
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
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Controle criado", entity: "controle", entityId: id, after: `${data.control} [${role}]` });
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
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Controle removido", entity: "controle", entityId: data.id });
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
      await c.storage.insertTechStack({ name: data.name, category: data.category, description: data.description, ...(data.icon ? { icon: data.icon } : {}) } as unknown as import("@/data/types").TechItem);
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Stack adicionada", entity: "stack", entityId: data.name, after: data.name });
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
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Stack removida", entity: "stack", entityId: data.name });
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const getN8nInfoFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ url: string; publicUrl: string; hasApiKey: boolean }> => {
    const { n8nBaseUrl, n8nPublicUrl, n8nApiKey } = await import("@/server/n8n");
    return { url: n8nBaseUrl(), publicUrl: n8nPublicUrl(), hasApiKey: !!n8nApiKey() };
  },
);

export const listN8nWorkflowsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<import("@/server/n8n").N8nWorkflow[]>> => {
    try {
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
      const { getN8nWorkflow } = await import("@/server/n8n");
      return { ok: true, data: await getN8nWorkflow(data.id) };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const createN8nWorkflowFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(1).max(120),
      nodes: z.any().optional(),
      connections: z.any().optional(),
      active: z.boolean().optional(),
    }).strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<import("@/server/n8n").N8nWorkflow>> => {
    try {
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
  },
);

export const updateN8nWorkflowFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.coerce.number().min(1),
      name: z.string().trim().min(1).max(120),
      nodes: z.any().optional(),
      connections: z.any().optional(),
      active: z.boolean().optional(),
    }).strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<import("@/server/n8n").N8nWorkflow>> => {
    try {
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
  },
);

export const deleteN8nWorkflowFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.coerce.number().min(1) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const { deleteN8nWorkflow } = await import("@/server/n8n");
      await deleteN8nWorkflow(data.id);
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  },
);

export const listAutomationSharesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiResult<import("@/server/storage").AutomationShare[]>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "automation.read");
      const shares = await c.storage.listAutomationShares();
      const user = await c.auth.getCurrentUser(c.storage);
      if (!user) return { ok: false, error: "Não autenticado." };
      const canSeeAll = can(user.role, "automation.admin") || can(user.role, "admin.manage");
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
        sharedRole: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor"]).nullable().optional(),
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
      if (existing && existing.ownerId !== user.id && !can(user.role, "automation.admin") && !can(user.role, "admin.manage")) {
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
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: existing ? "Automação compartilhada atualizada" : "Automação registrada", entity: "automação", entityId: data.workflowId, after: data.workflowName });
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
      if (share.ownerId !== user.id && !can(user.role, "automation.admin") && !can(user.role, "admin.manage")) {
        return { ok: false, error: "Sem permissão para remover." };
      }
      await c.storage.deleteAutomationShare(data.id);
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Automação removida", entity: "automação", entityId: share.workflowId });
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
      const { n8nPublicUrl, provisionN8nUser } = await import("@/server/n8n");
      const password = "Temp12345!";
      const n8nUser = await provisionN8nUser(user.email, user.name, password);
      return { ok: true, data: { n8nUrl: n8nPublicUrl(), message: `Usuário criado no n8n: ${n8nUser.email} (role: ${n8nUser.role}). Senha temporária: ${password}` } };
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

export const exportDatabaseFn = createServerFn({ method: "GET" }).handler(async (): Promise<ApiResult<import("@/server/storage").DatabaseDump>> => {
  try {
    const c = await ctx();
    await c.auth.requirePermission(c.storage, "admin.manage");
    const dump = await c.storage.exportDatabase();
    await c.storage.setMeta("last_backup_at", new Date().toISOString());
    return { ok: true, data: dump };
  } catch (e) {
    return { ok: false, error: errorMsg(e) };
  }
});

export const importDatabaseFn = createServerFn({ method: "POST" })
  .validator(z.object({ dump: z.any() }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      await c.auth.requirePermission(c.storage, "admin.manage");
      await c.storage.importDatabase(data.dump as import("@/server/storage").DatabaseDump);
      await c.storage.setMeta("last_backup_at", new Date().toISOString());
      await c.logAudit(c.storage, await c.auth.requireUser(c.storage), { action: "Backup restaurado", entity: "sistema", entityId: "import" });
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listNextStepsFn = createServerFn({ method: "GET" }).handler(async (): Promise<ApiResult<import("@/server/storage").NextStep[]>> => {
  try {
    const c = await ctx();
    return { ok: true, data: await c.storage.listNextSteps() };
  } catch (e) {
    return { ok: false, error: errorMsg(e) };
  }
});

export const createNextStepFn = createServerFn({ method: "POST" })
  .validator(z.object({ title: z.string().trim().min(3).max(120), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(["pendente", "em_andamento", "concluido"]).optional() }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const steps = await c.storage.listNextSteps();
      await c.storage.insertNextStep({ id: c.newId("ns"), title: data.title, due: data.due, status: data.status ?? "pendente", position: steps.length, createdAt: new Date().toISOString() });
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Próximo passo criado", entity: "next_step", entityId: data.title });
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const updateNextStepFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), title: z.string().trim().min(3).max(120).optional(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), status: z.enum(["pendente", "em_andamento", "concluido"]).optional() }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const { id, ...rest } = data;
      const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Partial<import("@/server/storage").NextStep>;
      const updated = await c.storage.updateNextStep(id, patch);
      if (!updated) return { ok: false, error: "Passo não encontrado." };
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Próximo passo atualizado", entity: "next_step", entityId: id });
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
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Próximo passo removido", entity: "next_step", entityId: data.id });
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

export const listLegalDocsFn = createServerFn({ method: "GET" }).handler(async (): Promise<ApiResult<import("@/server/storage").LegalDoc[]>> => {
  try {
    const c = await ctx();
    return { ok: true, data: await c.storage.listLegalDocs() };
  } catch (e) {
    return { ok: false, error: errorMsg(e) };
  }
});

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
  .validator(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), title: z.string().trim().min(3).max(120), subtitle: z.string().trim().max(200).optional().default(""), version: z.string().trim().min(1).max(20), intro: z.string().trim().max(5000).optional().default(""), clauses: z.array(z.object({ title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(5000) })).min(1).max(30), publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const user = await c.auth.requirePermission(c.storage, "admin.manage");
      const id = c.newId("ld");
      const now = new Date().toISOString();
      await c.storage.insertLegalDoc({ id, slug: data.slug, title: data.title, subtitle: data.subtitle ?? "", version: data.version, intro: data.intro ?? "", clauses: data.clauses, publishedAt: data.publishedAt, createdAt: now, updatedAt: now, createdById: user.id });
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Documento legal criado", entity: "legal_doc", entityId: id, after: `${data.slug} ${data.version}` });
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .validator(z.object({ currentPassword: z.string().min(1), newPassword: z.string().trim().min(8).max(200) }).strict())
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
      await c.logAudit(c.storage, { id: user.id, name: user.name, role: user.role }, { action: "Senha alterada", entity: "usuário", entityId: user.id });
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
      const raw = c.newId("rst") + Math.random().toString(36).slice(2);
      const tokenHash = await (await import("node:crypto")).createHash("sha256").update(raw).digest("hex");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      await c.storage.insertResetToken({ tokenHash, userId: target.id, createdAt: now.toISOString(), expiresAt, usedAt: null });
      await c.logAudit(c.storage, { id: actor.id, name: actor.name, role: actor.role }, { action: "Link de redefinição gerado", entity: "usuário", entityId: target.id });
      return { ok: true, data: { token: raw, expiresAt } };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(8), newPassword: z.string().trim().min(8).max(200) }).strict())
  .handler(async ({ data }): Promise<ApiResult<null>> => {
    try {
      const c = await ctx();
      const tokenHash = await (await import("node:crypto")).createHash("sha256").update(data.token).digest("hex");
      const rec = await c.storage.getResetTokenByHash(tokenHash);
      if (!rec) return { ok: false, error: "Token inválido." };
      if (rec.usedAt) return { ok: false, error: "Token já usado." };
      if (new Date(rec.expiresAt).getTime() < Date.now()) return { ok: false, error: "Token expirado." };
      const salt = c.pw.generateSaltHex();
      const hash = await c.pw.hashPassword(data.newPassword, c.pepper, salt);
      const { updateUserPassword } = await import("@/server/passwords-helpers");
      await updateUserPassword(c.storage, rec.userId, hash, salt);
      await c.storage.markResetTokenUsed(tokenHash, new Date().toISOString());
      await c.storage.deleteSessionsForUser(rec.userId);
      await c.logAudit(c.storage, null, { action: "Senha redefinida via token", entity: "usuário", entityId: rec.userId });
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

export const listUserSessionsFn = createServerFn({ method: "GET" }).handler(async (): Promise<ApiResult<import("@/server/storage").SessionRow[]>> => {
  try {
    const c = await ctx();
    const user = await c.auth.requireUser(c.storage);
    const isAdmin = can(user.role, "admin.manage");
    const targetId = user.id;
    const list = await c.storage.listSessionsForUser(targetId);
    void isAdmin;
    return { ok: true, data: list };
  } catch (e) {
    return { ok: false, error: errorMsg(e) };
  }
});

export const revokeAllSessionsFn = createServerFn({ method: "POST" }).handler(async (): Promise<ApiResult<null>> => {
  try {
    const c = await ctx();
    const user = await c.auth.requireUser(c.storage);
    await c.storage.deleteSessionsForUser(user.id);
    await c.auth.destroyCurrentSession(c.storage);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errorMsg(e) };
  }
});

export const globalSearchFn = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().trim().min(1).max(80) }).strict())
  .handler(async ({ data }): Promise<ApiResult<{ tasks: import("@/data/types").Task[]; risks: import("@/data/types").Risk[]; wiki: import("@/data/types").WikiArticle[]; controls: import("@/data/types").ComplianceControl[] }>> => {
    try {
      const c = await ctx();
      await c.auth.requireUser(c.storage);
      const q = data.q.toLowerCase();
      const [tasks, risks, wiki, controls] = await Promise.all([c.storage.listTasks(), c.storage.listRisks(), c.storage.listWiki(), c.storage.listControls()]);
      return {
        ok: true,
        data: {
          tasks: tasks.filter((t) => `${t.title} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(q)).slice(0, 10),
          risks: risks.filter((r) => `${r.title} ${r.category} ${r.mitigation}`.toLowerCase().includes(q)).slice(0, 10),
          wiki: wiki.filter((w) => `${w.title} ${w.summary} ${w.category}`.toLowerCase().includes(q)).slice(0, 10),
          controls: controls.filter((co) => `${co.control} ${co.norm} ${co.owner}`.toLowerCase().includes(q)).slice(0, 10),
        },
      };
    } catch (e) {
      return { ok: false, error: errorMsg(e) };
    }
  });

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
        role: z.enum(["admin", "diretor", "gestor", "desenvolvedor", "auditor"]),
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

