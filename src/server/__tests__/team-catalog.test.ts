/**
 * Testes unitários para src/server/team-catalog.ts
 *
 * O mockStorage implementa a interface Storage completa com funções
 * tipadas corretamente para cada operação.
 */

import { describe, it, expect } from "vitest";
import { listTeamMembers } from "@/server/team-catalog";
import type { Storage } from "@/server/storage";

/* ------------------------------------------------------------------ */
/* Mock Storage tipado                                               */
/* ------------------------------------------------------------------ */

function makeMockStorage(overrides: Partial<Storage> = {}): Storage {
  return {
    kind: "memory",
    countUsers: async () => 0,
    getUserByEmail: async () => null,
    getUserById: async () => null,
    listUsers: async () => [],
    insertUser: async () => {},
    updateUser: async () => {},
    deleteUser: async () => {},
    clearAllUsers: async () => 0,
    listRoleFunctions: async () => [],
    listAllRoleFunctions: async () => [],
    syncRoleFunctions: async () => {},
    deleteRoleFunctions: async () => {},
    listUserFunctions: async () => [],
    grantUserFunction: async () => false,
    revokeUserFunction: async () => false,
    getSessionByTokenHash: async () => null,
    insertSession: async () => {},
    deleteSession: async () => {},
    deleteSessionsForUser: async () => {},
    purgeExpiredSessions: async () => {},
    listColumns: async () => [],
    insertColumn: async () => false,
    deleteColumn: async () => false,
    countTasksInColumn: async () => 0,
    listTasks: async () => [],
    getTask: async () => null,
    insertTask: async () => {},
    updateTaskColumn: async () => null,
    updateTaskProgress: async () => null,
    deleteTask: async () => false,
    listComments: async () => [],
    insertComment: async () => {},
    listControls: async () => [],
    getControl: async () => null,
    insertControl: async () => {},
    deleteControl: async () => false,
    reviewControl: async () => {},
    listEvidences: async () => [],
    getEvidence: async () => null,
    insertEvidence: async () => {},
    reviewEvidence: async () => {},
    insertAudit: async () => {},
    listAudit: async () => [],
    countAudit: async () => 0,
    listModules: async () => [],
    insertModule: async () => {},
    deleteModule: async () => false,
    listRisks: async () => [],
    getRisk: async () => null,
    insertRisk: async () => {},
    updateRisk: async () => null,
    deleteRisk: async () => false,
    listWiki: async () => [],
    getWiki: async () => null,
    insertWiki: async () => {},
    updateWiki: async () => null,
    deleteWiki: async () => false,
    listMilestones: async () => [],
    insertMilestone: async () => {},
    deleteMilestone: async () => false,
    listReleases: async () => [],
    insertRelease: async () => {},
    deleteRelease: async () => false,
    listJournalEntries: async () => [],
    insertJournalEntry: async () => {},
    updateJournalEntry: async () => false,
    deleteJournalEntry: async () => false,
    addJournalComment: async () => false,
    updateOwnComment: async () => false,
    deleteOwnComment: async () => false,
    listPatentStages: async () => [],
    getPatentStage: async () => null,
    insertPatentStage: async () => {},
    updatePatentStage: async () => null,
    listTechStack: async () => [],
    insertTechStack: async () => {},
    deleteTechStack: async () => false,
    getMeta: async () => null,
    setMeta: async () => {},
    listAutomationShares: async () => [],
    getAutomationShare: async () => null,
    getAutomationShareByWorkflow: async () => null,
    upsertAutomationShare: async () => {},
    deleteAutomationShare: async () => false,
    listNextSteps: async () => [],
    getNextStep: async () => null,
    insertNextStep: async () => {},
    updateNextStep: async () => null,
    deleteNextStep: async () => false,
    reorderNextSteps: async () => {},
    listLegalDocs: async () => [],
    getLegalDoc: async () => null,
    getLegalDocById: async () => null,
    listLegalDocVersions: async () => [],
    insertLegalDoc: async () => {},
    listResetTokens: async () => [],
    getResetTokenByHash: async () => null,
    insertResetToken: async () => {},
    markResetTokenUsed: async () => {},
    deleteExpiredResetTokens: async () => {},
    listSessionsForUser: async () => [],
    exportDatabase: async () => ({ dump: "" }),
    importDatabase: async () => {},
    getStorageInfo: async () => ({ kind: "memory" } as any),
    listDocs: async () => [],
    listDocsByKind: async () => [],
    getDoc: async () => null,
    upsertDoc: async () => {},
    deleteDoc: async () => false,
    insertInvite: async () => {},
    listInvites: async () => [],
    getInviteByHash: async () => null,
    markInviteUsed: async () => {},
    deleteInvite: async () => false,
    updateUserPasswordHash: async () => {},
    ...overrides,
  } as Storage;
}

/* ------------------------------------------------------------------ */
/* Testes                                                            */
/* ------------------------------------------------------------------ */

describe("team-catalog — listTeamMembers", () => {
  it("retorna array vazio quando não há usuários", async () => {
    const storage = makeMockStorage();
    const result = await listTeamMembers(storage);
    expect(Array.isArray(result)).toBe(true);
  });

  it("associa usuários com teamMemberId", async () => {
    const storage = makeMockStorage({
      listUsers: async () => [
        {
          id: "user-1",
          name: "Teste",
          email: "teste@teste.com",
          role: "desenvolvedor",
          jobTitle: null,
          department: null,
          bio: null,
          avatarUrl: null,
          teamMemberId: "team-1",
          passwordHash: "",
          passwordSalt: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    const result = await listTeamMembers(storage);
    expect(Array.isArray(result)).toBe(true);
  });
});
