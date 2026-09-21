import type {
  Direction,
  LearningProgress,
  LocalList,
  LocalProfile,
  LocalVocabItem,
} from "../domain/types";
import type { DirectionStats, LegacyState, LegacyVocabItem } from "../legacyTypes";
import type { SoleilDatabase } from "./db";

export interface LocalRepository {
  getProfile(): Promise<LocalProfile>;
  listActiveLists(): Promise<LocalList[]>;
  listItems(listId: string): Promise<LocalVocabItem[]>;
  saveLocalList(list: LocalList, items: LocalVocabItem[]): Promise<void>;
  recordAnswer(itemId: string, direction: Direction, correct: boolean): Promise<void>;
  resetAll(): Promise<void>;
  saveLegacyState(state: LegacyState): Promise<void>;
  loadLegacyState(fallback: LegacyState): Promise<LegacyState>;
}

const DEFAULT_PROFILE: LocalProfile = {
  id: "local",
  learningName: "Lernprofi",
  xp: 0,
  streak: 0,
  lastActiveDate: null,
};

async function ensureProfile(db: SoleilDatabase): Promise<LocalProfile> {
  return db.transaction("rw", db.profile, async () => {
    const existing = await db.profile.get("local");
    if (existing) return existing;
    await db.profile.add(DEFAULT_PROFILE);
    return { ...DEFAULT_PROFILE };
  });
}

export function createLocalRepository(db: SoleilDatabase): LocalRepository {
  return {
    async getProfile() {
      return ensureProfile(db);
    },

    async listActiveLists() {
      const lists = await db.lists.toArray();
      return lists.filter((list) => list.active).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    },

    async listItems(listId) {
      const items = await db.items.where("listId").equals(listId).toArray();
      return items.filter((item) => item.active);
    },

    async saveLocalList(list, items) {
      if (list.source !== "local") throw new Error("Nur lokale Listen können hier gespeichert werden.");
      if (items.some((item) => item.listId !== list.id)) throw new Error("Eine Vokabel gehört zu einer anderen Liste.");
      await db.transaction("rw", db.lists, db.items, async () => {
        await db.lists.put(list);
        await db.items.where("listId").equals(list.id).delete();
        if (items.length) await db.items.bulkPut(items);
      });
    },

    async recordAnswer(itemId, direction, correct) {
      await db.transaction("rw", db.items, db.progress, async () => {
        if (!await db.items.get(itemId)) throw new Error("Die Vokabel wurde nicht gefunden.");
        const existing = await db.progress.get([itemId, direction]);
        const next: LearningProgress = {
          itemId,
          direction,
          attempts: (existing?.attempts ?? 0) + 1,
          errors: (existing?.errors ?? 0) + (correct ? 0 : 1),
          correctStreak: correct ? (existing?.correctStreak ?? 0) + 1 : 0,
          lastReviewedAt: new Date().toISOString(),
        };
        await db.progress.put(next);
      });
    },

    async resetAll() {
      await db.transaction("rw", db.profile, db.lists, db.items, db.progress, db.settings, async () => {
        await Promise.all([
          db.profile.clear(),
          db.lists.clear(),
          db.items.clear(),
          db.progress.clear(),
          db.settings.clear(),
        ]);
        await db.settings.put({ key: "legacyMigrationV1", value: "done" });
      });
    },

    async saveLegacyState(state) {
      const localLists: LocalList[] = state.lists
        .filter((list) => list.source !== "published")
        .map((list) => ({
          id: list.id,
          source: "local",
          name: list.name,
          description: list.description,
          contentVersion: list.contentVersion ?? 1,
          active: list.active ?? true,
          updatedAt: list.updatedAt,
        }));
      const localListIds = new Set(localLists.map((list) => list.id));
      const localItems: LocalVocabItem[] = state.items
        .filter((item) => localListIds.has(item.listId))
        .map((item) => ({
          id: item.id,
          listId: item.listId,
          french: item.french,
          german: item.german,
          example: item.example,
          imageUrl: item.imageUrl ?? null,
          active: item.active ?? true,
        }));
      const progress: LearningProgress[] = state.items.flatMap((item) =>
        (["fr-de", "de-fr"] as const).flatMap((direction) => {
          const stats = item.stats[direction];
          return stats ? [{
            itemId: item.id,
            direction,
            attempts: stats.correct + stats.wrong,
            errors: stats.wrong,
            correctStreak: stats.streak,
            lastReviewedAt: item.lastAsked,
          }] : [];
        }),
      );
      const profile: LocalProfile = {
        id: "local",
        learningName: state.profile.name,
        xp: state.profile.totalXp,
        streak: state.profile.streak,
        lastActiveDate: state.profile.lastActivityDate,
      };

      await db.transaction("rw", db.profile, db.lists, db.items, db.progress, db.settings, async () => {
        const existingLocalLists = (await db.lists.toArray()).filter((list) => list.source === "local");
        const staleListIds = existingLocalLists.filter((list) => !localListIds.has(list.id)).map((list) => list.id);
        const existingLocalListIds = new Set(existingLocalLists.map((list) => list.id));
        const staleItemIds = (await db.items.toArray())
          .filter((item) => existingLocalListIds.has(item.listId) && !localItems.some((candidate) => candidate.id === item.id))
          .map((item) => item.id);
        await db.profile.put(profile);
        if (staleListIds.length) await db.lists.bulkDelete(staleListIds);
        if (staleItemIds.length) await db.items.bulkDelete(staleItemIds);
        if (localLists.length) await db.lists.bulkPut(localLists);
        if (localItems.length) await db.items.bulkPut(localItems);
        if (progress.length) await db.progress.bulkPut(progress);
        await db.settings.bulkPut([
          { key: "activeListId", value: state.activeListId ?? "" },
          { key: "dailyGoal", value: String(state.profile.dailyGoal) },
          { key: "dailyXp", value: String(state.profile.dailyXp) },
          { key: "weeklyXp", value: String(state.profile.weeklyXp) },
        ]);
      });
    },

    async loadLegacyState(fallback) {
      const [profile, lists, items, progress, settings] = await Promise.all([
        ensureProfile(db),
        db.lists.toArray(),
        db.items.toArray(),
        db.progress.toArray(),
        db.settings.toArray(),
      ]);
      const setting = new Map(settings.map((entry) => [entry.key, entry.value]));
      const statsByItem = new Map<string, LegacyVocabItem["stats"]>();
      for (const row of progress) {
        const stats = statsByItem.get(row.itemId) ?? {};
        const directionStats: DirectionStats = {
          correct: row.attempts - row.errors,
          wrong: row.errors,
          streak: row.correctStreak,
        };
        stats[row.direction] = directionStats;
        statsByItem.set(row.itemId, stats);
      }
      const activeLists = lists.filter((list) => list.active);
      const activeListIds = new Set(activeLists.map((list) => list.id));
      const legacyItems: LegacyVocabItem[] = items
        .filter((item) => item.active && activeListIds.has(item.listId))
        .map((item) => {
          const prior = fallback.items.find((candidate) => candidate.id === item.id);
          const rows = progress.filter((row) => row.itemId === item.id);
          return {
            id: item.id,
            listId: item.listId,
            french: item.french,
            german: item.german,
            example: item.example,
            difficulty: prior?.difficulty ?? 1,
            lastAsked: rows.map((row) => row.lastReviewedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
            nextReview: prior?.nextReview ?? null,
            stats: statsByItem.get(item.id) ?? {},
            imageUrl: item.imageUrl,
            active: item.active,
          };
        });
      const requestedActiveList = setting.get("activeListId") ?? setting.get("legacyActiveListId") ?? "";
      return {
        ...fallback,
        profile: {
          ...fallback.profile,
          name: profile.learningName,
          totalXp: profile.xp,
          streak: profile.streak,
          lastActivityDate: profile.lastActiveDate,
          dailyGoal: Number(setting.get("dailyGoal") ?? setting.get("legacyDailyGoal") ?? fallback.profile.dailyGoal),
          dailyXp: Number(setting.get("dailyXp") ?? setting.get("legacyDailyXp") ?? fallback.profile.dailyXp),
          weeklyXp: Number(setting.get("weeklyXp") ?? setting.get("legacyWeeklyXp") ?? fallback.profile.weeklyXp),
        },
        lists: activeLists.map((list) => ({
          id: list.id,
          name: list.name,
          description: list.description,
          createdAt: list.updatedAt,
          updatedAt: list.updatedAt,
          source: list.source,
          contentVersion: list.contentVersion,
          active: list.active,
        })),
        items: legacyItems,
        activeListId: activeListIds.has(requestedActiveList) ? requestedActiveList : activeLists[0]?.id ?? null,
      };
    },
  };
}
