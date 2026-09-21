import { expect, test } from "vitest";
import {
  createInitialState,
  loadState,
  saveState,
  recordDailyActivity,
  addVocabList,
  addVocabItem,
  deleteVocabList,
  addXpToProfile,
} from "../../src/storage/legacyStore";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

test("createInitialState includes a ready-to-learn demo list", () => {
  const state = createInitialState();
  expect(state.lists.length).toBeGreaterThanOrEqual(1);
  expect(state.items.length).toBeGreaterThanOrEqual(8);
  expect(state.version).toBe(1);
});

test("saveState and loadState preserve user data", () => {
  const storage = memoryStorage();
  const state = createInitialState();
  state.profile.name = "Léa";
  saveState(storage, state);
  expect(loadState(storage).profile.name).toBe("Léa");
});

test("loadState recovers from invalid stored JSON", () => {
  const storage = memoryStorage({ "vocab-solar-state": "{not-json" });
  expect(loadState(storage).version).toBe(1);
});

test("recordDailyActivity extends and resets a streak correctly", () => {
  const profile = { streak: 2, lastActivityDate: "2026-09-13" };
  expect(recordDailyActivity(profile, "2026-09-14").streak).toBe(3);
  expect(recordDailyActivity(profile, "2026-09-16").streak).toBe(1);
  expect(recordDailyActivity(profile, "2026-09-13").streak).toBe(2);
});

test("addXpToProfile resets the daily counter on a new day", () => {
  const profile = { streak: 2, lastActivityDate: "2026-09-13", dailyXp: 120, weeklyXp: 100, totalXp: 500 };
  const next = addXpToProfile(profile, 12, "2026-09-14");
  expect(next.dailyXp).toBe(12);
  expect(next.weeklyXp).toBe(112);
  expect(next.totalXp).toBe(512);
  expect(next.streak).toBe(3);
});

test("addXpToProfile accumulates XP on the same day", () => {
  const profile = { streak: 2, lastActivityDate: "2026-09-14", dailyXp: 120, weeklyXp: 100, totalXp: 500 };
  expect(addXpToProfile(profile, 12, "2026-09-14").dailyXp).toBe(132);
});

test("list and item actions validate required values", () => {
  const state = createInitialState();
  expect(() => addVocabList(state, { name: " " })).toThrow(/Name/);
  expect(() => addVocabItem(state, state.lists[0]!.id, { french: "", german: "Haus" })).toThrow(/Französisch/);
});

test("deleting a list also deletes its vocabulary items", () => {
  let state = createInitialState();
  state = addVocabList(state, { name: "Test" });
  const listId = state.lists.at(-1)!.id;
  state = addVocabItem(state, listId, { french: "oui", german: "ja" });
  state = deleteVocabList(state, listId);
  expect(state.lists.some((list) => list.id === listId)).toBe(false);
  expect(state.items.some((item) => item.listId === listId)).toBe(false);
});
