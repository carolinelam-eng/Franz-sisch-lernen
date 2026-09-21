import type { DirectionStats, LegacyState } from "../legacyTypes";
import type {
  Direction,
  LearningProgress,
  LocalList,
  LocalProfile,
  LocalVocabItem,
  SettingRecord,
} from "../domain/types";
import { STORAGE_KEY } from "./legacyStore";
import type { SoleilDatabase } from "./db";

const MIGRATION_KEY = "legacyMigrationV1";
const INVALID_STORAGE_KEY = `${STORAGE_KEY}-invalid`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyState(value: unknown): value is LegacyState {
  if (!isRecord(value) || value.version !== 1) return false;
  if (!Array.isArray(value.lists) || !Array.isArray(value.items)) return false;
  if (!isRecord(value.profile) || !isRecord(value.classPreview)) return false;
  return typeof value.profile.name === "string"
    && typeof value.profile.totalXp === "number"
    && typeof value.profile.streak === "number"
    && value.lists.every((list) => isRecord(list) && typeof list.id === "string" && typeof list.name === "string")
    && value.items.every((item) => isRecord(item)
      && typeof item.id === "string"
      && typeof item.listId === "string"
      && typeof item.french === "string"
      && typeof item.german === "string");
}

function mapProgress(state: LegacyState): LearningProgress[] {
  const rows: LearningProgress[] = [];
  for (const item of state.items) {
    for (const direction of ["fr-de", "de-fr"] as const) {
      const stats: DirectionStats | undefined = item.stats?.[direction];
      if (!stats) continue;
      rows.push({
        itemId: item.id,
        direction,
        attempts: stats.correct + stats.wrong,
        errors: stats.wrong,
        correctStreak: stats.streak,
        lastReviewedAt: item.lastAsked,
      });
    }
  }
  return rows;
}

export async function migrateLegacyState(
  db: SoleilDatabase,
  storage: Storage = localStorage,
): Promise<"migrated" | "skipped" | "invalid"> {
  if ((await db.settings.get(MIGRATION_KEY))?.value === "done") return "skipped";
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    await db.settings.put({ key: MIGRATION_KEY, value: "done" });
    return "skipped";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    storage.setItem(INVALID_STORAGE_KEY, raw);
    await db.settings.put({ key: MIGRATION_KEY, value: "done" });
    return "invalid";
  }

  if (!isLegacyState(parsed)) {
    storage.setItem(INVALID_STORAGE_KEY, raw);
    await db.settings.put({ key: MIGRATION_KEY, value: "done" });
    return "invalid";
  }

  const profile: LocalProfile = {
    id: "local",
    learningName: parsed.profile.name,
    xp: parsed.profile.totalXp,
    streak: parsed.profile.streak,
    lastActiveDate: parsed.profile.lastActivityDate,
  };
  const lists: LocalList[] = parsed.lists.map((list) => ({
    id: list.id,
    source: "local",
    name: list.name,
    description: list.description,
    contentVersion: 1,
    active: true,
    updatedAt: list.updatedAt,
  }));
  const items: LocalVocabItem[] = parsed.items.map((item) => ({
    id: item.id,
    listId: item.listId,
    french: item.french,
    german: item.german,
    example: item.example,
    imageUrl: null,
    active: true,
  }));
  const progress = mapProgress(parsed);
  const settings: SettingRecord[] = [
    { key: "legacyActiveListId", value: parsed.activeListId ?? "" },
    { key: "legacyDailyGoal", value: String(parsed.profile.dailyGoal) },
    { key: "legacyDailyXp", value: String(parsed.profile.dailyXp) },
    { key: "legacyWeeklyXp", value: String(parsed.profile.weeklyXp) },
    { key: MIGRATION_KEY, value: "done" },
  ];

  await db.transaction("rw", db.profile, db.lists, db.items, db.progress, db.settings, async () => {
    await db.profile.put(profile);
    await db.lists.bulkPut(lists);
    await db.items.bulkPut(items);
    if (progress.length) await db.progress.bulkPut(progress);
    await db.settings.bulkPut(settings);
  });
  return "migrated";
}
