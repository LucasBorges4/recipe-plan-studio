import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { roleLabel, defaultRoleForNewUser } from "@/lib/rbac";
import type { PublicUser } from "@/lib/rbac";
import type { AuditEntry, PortalStatePayload } from "@/lib/records";
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

function fmtBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function addMonthsBR(d: Date, months: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

const BR_DATE = /^\d{2}\/\d{2}\/\d{4}$/;

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

export const registerFn = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        name: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
        email: z.string().trim().email("E-mail inválido").max(120, "E-mail muito longo"),
        password: z.string().trim().min(8, "Senha muito curta").max(200, "Senha muito longa"),
        jobTitle: z.string().trim().max(80, "Cargo muito longo").optional(),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<ApiResult<PublicUser>> => {
    try {
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
      const role = count === 0 ? "admin" : defaultRoleForNewUser;
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
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now,
      });

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
    const { getStorage, isStoragePersistent } = await import("@/server/storage");
    const storage = await getStorage();
    const [tasks, columns, controls, comments, evidences, modules, auditCount] = await Promise.all([
      storage.listTasks(),
      storage.listColumns(),
      storage.listControls(),
      storage.listComments(),
      storage.listEvidences(),
      storage.listModules(),
      storage.countAudit(),
    ]);
    return {
      persistent: isStoragePersistent(),
      tasks,
      columns,
      controls,
      comments,
      evidences,
      modules,
      auditCount,
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

      const approving = data.column === "Concluído" && task.column === "Em Aprovação";
      const perm = approving ? "task.approve" : "task.move";
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
        date: fmtBR(new Date()),
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
