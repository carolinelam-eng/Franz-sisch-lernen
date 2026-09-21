import { afterEach, beforeEach, expect, test } from "vitest";
import type { LocalList, LocalVocabItem } from "../../src/domain/types";
import { SoleilDatabase } from "../../src/storage/db";
import { createLocalRepository } from "../../src/storage/repository";
import { createInitialState } from "../../src/storage/legacyStore";

let db: SoleilDatabase;

beforeEach(() => {
  db = new SoleilDatabase(`repository-${crypto.randomUUID()}`);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

test("creates the deterministic local profile only when it is missing", async () => {
  const repository = createLocalRepository(db);
  await expect(repository.getProfile()).resolves.toEqual({
    id: "local",
    learningName: "Lernprofi",
    xp: 0,
    streak: 0,
    lastActiveDate: null,
  });

  await db.profile.update("local", { learningName: "Léa", xp: 50 });
  await expect(repository.getProfile()).resolves.toMatchObject({ learningName: "Léa", xp: 50 });
});

test("saves a local list and its items atomically", async () => {
  const repository = createLocalRepository(db);
  const list: LocalList = {
    id: "unit-1",
    source: "local",
    name: "Unité 1",
    description: "Schule",
    contentVersion: 1,
    active: true,
    updatedAt: "2026-09-20T10:00:00.000Z",
  };
  const items: LocalVocabItem[] = [{
    id: "bonjour",
    listId: list.id,
    french: "bonjour",
    german: "guten Tag",
    example: "Bonjour !",
    imageUrl: null,
    active: true,
  }];

  await repository.saveLocalList(list, items);

  await expect(repository.listActiveLists()).resolves.toEqual([list]);
  await expect(repository.listItems(list.id)).resolves.toEqual(items);
});

test("rejects items that belong to a different list before writing", async () => {
  const repository = createLocalRepository(db);
  const list: LocalList = {
    id: "unit-1",
    source: "local",
    name: "Unité 1",
    description: "",
    contentVersion: 1,
    active: true,
    updatedAt: "2026-09-20T10:00:00.000Z",
  };
  const wrongItem: LocalVocabItem = {
    id: "bonjour",
    listId: "other",
    french: "bonjour",
    german: "guten Tag",
    example: "",
    imageUrl: null,
    active: true,
  };

  await expect(repository.saveLocalList(list, [wrongItem])).rejects.toThrow(/Liste/);
  expect(await db.lists.count()).toBe(0);
});

test("records answers separately per direction", async () => {
  const repository = createLocalRepository(db);
  await db.items.add({
    id: "bonjour",
    listId: "unit-1",
    french: "bonjour",
    german: "guten Tag",
    example: "",
    imageUrl: null,
    active: true,
  });

  await repository.recordAnswer("bonjour", "fr-de", false);
  await repository.recordAnswer("bonjour", "fr-de", true);
  await repository.recordAnswer("bonjour", "de-fr", true);

  expect(await db.progress.get(["bonjour", "fr-de"])).toMatchObject({ attempts: 2, errors: 1, correctStreak: 1 });
  expect(await db.progress.get(["bonjour", "de-fr"])).toMatchObject({ attempts: 1, errors: 0, correctStreak: 1 });
});

test("does not record progress for an unknown item", async () => {
  const repository = createLocalRepository(db);
  await expect(repository.recordAnswer("missing", "fr-de", true)).rejects.toThrow(/Vokabel/);
  expect(await db.progress.count()).toBe(0);
});

test("round-trips the legacy UI state through IndexedDB", async () => {
  const repository = createLocalRepository(db);
  const state = createInitialState();
  state.profile.name = "Léa";
  state.profile.totalXp = 777;
  state.activeListId = state.lists[0]!.id;
  state.items[0]!.stats["fr-de"] = { correct: 3, wrong: 1, streak: 2 };

  await repository.saveLegacyState(state);
  const restored = await repository.loadLegacyState(createInitialState());

  expect(restored.profile).toMatchObject({ name: "Léa", totalXp: 777 });
  expect(restored.activeListId).toBe(state.activeListId);
  expect(restored.items[0]?.stats["fr-de"]).toEqual({ correct: 3, wrong: 1, streak: 2 });
});

test("resets all local learning data and the saved collection connection", async () => {
  const repository = createLocalRepository(db);
  const state = createInitialState();
  state.items[0]!.stats["fr-de"] = { correct: 2, wrong: 1, streak: 1 };
  await repository.saveLegacyState(state);
  await db.settings.put({ key: "collectionSubscription", value: "abcdefghijklmnopqrstuvwxyzABCDEF" });
  await db.lists.put({
    id: "published-list",
    source: "published",
    name: "Veröffentlicht",
    description: "",
    contentVersion: 1,
    active: true,
    updatedAt: "2026-09-20T10:00:00.000Z",
  });

  await repository.resetAll();

  expect(await db.profile.count()).toBe(0);
  expect(await db.lists.count()).toBe(0);
  expect(await db.items.count()).toBe(0);
  expect(await db.progress.count()).toBe(0);
  expect(await db.settings.toArray()).toEqual([{ key: "legacyMigrationV1", value: "done" }]);
  const restored = await repository.loadLegacyState(createInitialState());
  expect(restored.lists).toEqual([]);
  expect(restored.profile).toMatchObject({ name: "Lernprofi", totalXp: 0, streak: 0 });
});
