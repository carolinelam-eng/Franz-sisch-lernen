import { afterEach, beforeEach, expect, test } from "vitest";
import type { PublishedCollection } from "../../src/content/types";
import { mergePublishedCollection } from "../../src/content/mergePublishedCollection";
import { SoleilDatabase } from "../../src/storage/db";

let db: SoleilDatabase;

function snapshot(version = 1): PublishedCollection {
  return {
    collectionId: "class-7b",
    version,
    publishedAt: `2026-09-${String(19 + version).padStart(2, "0")}T10:00:00.000Z`,
    lists: [{
      id: "unit-1",
      name: "Unité 1",
      description: "Schule",
      version,
      updatedAt: `2026-09-${String(19 + version).padStart(2, "0")}T10:00:00.000Z`,
      items: [{
        id: "bonjour",
        listId: "unit-1",
        french: "bonjour",
        german: version === 1 ? "guten Tag" : "hallo",
        example: "Bonjour !",
        imageUrl: null,
      }],
    }],
  };
}

beforeEach(() => {
  db = new SoleilDatabase(`merge-${crypto.randomUUID()}`);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

test("inserts the first published snapshot as active content", async () => {
  await expect(mergePublishedCollection(db, snapshot())).resolves.toEqual({
    changed: true,
    collectionVersion: 1,
    activeListCount: 1,
  });
  expect(await db.lists.get("unit-1")).toMatchObject({ source: "published", active: true, contentVersion: 1 });
  expect(await db.items.get("bonjour")).toMatchObject({ german: "guten Tag", active: true });
  expect(await db.settings.get("lastCollectionVersion")).toMatchObject({ value: "1" });
});

test("performs no writes for an identical collection version", async () => {
  await mergePublishedCollection(db, snapshot());
  const before = {
    lists: await db.lists.toArray(),
    items: await db.items.toArray(),
    settings: await db.settings.toArray(),
  };

  await expect(mergePublishedCollection(db, snapshot())).resolves.toEqual({
    changed: false,
    collectionVersion: 1,
    activeListCount: 1,
  });
  expect(await db.lists.toArray()).toEqual(before.lists);
  expect(await db.items.toArray()).toEqual(before.items);
  expect(await db.settings.toArray()).toEqual(before.settings);
});

test("updates published text without changing learning progress", async () => {
  await mergePublishedCollection(db, snapshot());
  await db.progress.put({
    itemId: "bonjour",
    direction: "fr-de",
    attempts: 4,
    errors: 1,
    correctStreak: 3,
    lastReviewedAt: "2026-09-20T12:00:00.000Z",
  });
  const progressBefore = await db.progress.toArray();

  await mergePublishedCollection(db, snapshot(2));

  expect((await db.items.get("bonjour"))?.german).toBe("hallo");
  expect(await db.progress.toArray()).toEqual(progressBefore);
});

test("marks removed published records inactive instead of deleting them", async () => {
  await mergePublishedCollection(db, snapshot());
  const empty = { ...snapshot(2), lists: [] };

  await mergePublishedCollection(db, empty);

  expect(await db.lists.get("unit-1")).toMatchObject({ active: false });
  expect(await db.items.get("bonjour")).toMatchObject({ active: false });
});

test("reactivates stable IDs and retains their earlier progress", async () => {
  await mergePublishedCollection(db, snapshot());
  await db.progress.put({
    itemId: "bonjour",
    direction: "fr-de",
    attempts: 2,
    errors: 1,
    correctStreak: 0,
    lastReviewedAt: null,
  });
  await mergePublishedCollection(db, { ...snapshot(2), lists: [] });

  await mergePublishedCollection(db, snapshot(3));

  expect(await db.lists.get("unit-1")).toMatchObject({ active: true });
  expect(await db.items.get("bonjour")).toMatchObject({ active: true });
  expect(await db.progress.get(["bonjour", "fr-de"])).toMatchObject({ attempts: 2, errors: 1 });
});

test("rejects a mismatched item list before writing anything", async () => {
  const invalid = snapshot();
  invalid.lists[0]!.items[0]!.listId = "other";

  await expect(mergePublishedCollection(db, invalid)).rejects.toThrow(/listId/);
  expect(await db.lists.count()).toBe(0);
  expect(await db.items.count()).toBe(0);
  expect(await db.settings.count()).toBe(0);
});

test("never overwrites a local list or its items when IDs collide", async () => {
  await db.lists.put({
    id: "unit-1",
    source: "local",
    name: "Meine Liste",
    description: "",
    contentVersion: 1,
    active: true,
    updatedAt: "2026-09-19T10:00:00.000Z",
  });
  await db.items.put({
    id: "bonjour",
    listId: "unit-1",
    french: "mein Wort",
    german: "meine Übersetzung",
    example: "",
    imageUrl: null,
    active: true,
  });

  await expect(mergePublishedCollection(db, snapshot())).rejects.toThrow(/lokalen/);
  expect(await db.lists.get("unit-1")).toMatchObject({ source: "local", name: "Meine Liste" });
  expect(await db.items.get("bonjour")).toMatchObject({ french: "mein Wort" });
});
