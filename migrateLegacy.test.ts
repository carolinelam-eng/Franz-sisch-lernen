import { afterEach, beforeEach, expect, test } from "vitest";
import { SoleilDatabase } from "../../src/storage/db";
import { migrateLegacyState } from "../../src/storage/migrateLegacy";
import { createLocalRepository } from "../../src/storage/repository";

let db: SoleilDatabase;

function legacyFixture(): string {
  return JSON.stringify({
    version: 1,
    profile: {
      id: "local-user",
      name: "Léa",
      streak: 4,
      lastActivityDate: "2026-09-19",
      totalXp: 140,
      weeklyXp: 80,
      dailyXp: 20,
      dailyGoal: 150,
    },
    lists: [{
      id: "school",
      name: "Schule",
      description: "Unité 1",
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-18T10:00:00.000Z",
    }],
    items: [
      {
        id: "bonjour",
        listId: "school",
        french: "bonjour",
        german: "guten Tag",
        example: "Bonjour, Léa.",
        difficulty: 2,
        lastAsked: "2026-09-19T12:00:00.000Z",
        nextReview: null,
        stats: { "fr-de": { correct: 2, wrong: 1, streak: 1 } },
      },
      {
        id: "livre",
        listId: "school",
        french: "le livre",
        german: "das Buch",
        example: "Je lis un livre.",
        difficulty: 1,
        lastAsked: null,
        nextReview: null,
        stats: {},
      },
    ],
    sessions: [],
    classPreview: { id: "class-7b", name: "7b", inviteCode: "TEST", weeklyGoal: 1000, members: [] },
    activeListId: "school",
  });
}

beforeEach(() => {
  db = new SoleilDatabase(`migration-${crypto.randomUUID()}`);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

test("migrates profile, lists, vocabulary and per-direction progress", async () => {
  localStorage.setItem("vocab-solar-state", legacyFixture());

  await expect(migrateLegacyState(db)).resolves.toBe("migrated");

  expect(await db.profile.get("local")).toMatchObject({ xp: 140, streak: 4 });
  expect(await db.lists.get("school")).toMatchObject({ source: "local", active: true });
  expect(await db.items.count()).toBe(2);
  expect(await db.progress.get(["bonjour", "fr-de"])).toMatchObject({
    attempts: 3,
    errors: 1,
    correctStreak: 1,
  });
  expect(await db.settings.get("legacyMigrationV1")).toMatchObject({ value: "done" });
  expect(localStorage.getItem("vocab-solar-state")).toBe(legacyFixture());
});

test("skips a second migration without replacing migrated values", async () => {
  localStorage.setItem("vocab-solar-state", legacyFixture());
  await migrateLegacyState(db);
  const changed = JSON.parse(legacyFixture()) as { profile: { totalXp: number } };
  changed.profile.totalXp = 999;
  localStorage.setItem("vocab-solar-state", JSON.stringify(changed));

  await expect(migrateLegacyState(db)).resolves.toBe("skipped");
  expect((await db.profile.get("local"))?.xp).toBe(140);
});

test("quarantines malformed JSON and still marks migration complete", async () => {
  localStorage.setItem("vocab-solar-state", "{not-json");

  await expect(migrateLegacyState(db)).resolves.toBe("invalid");

  expect(localStorage.getItem("vocab-solar-state-invalid")).toBe("{not-json");
  expect(await db.settings.get("legacyMigrationV1")).toMatchObject({ value: "done" });
});

test("does not restore legacy localStorage after all data is reset", async () => {
  localStorage.setItem("vocab-solar-state", legacyFixture());
  await migrateLegacyState(db);

  await createLocalRepository(db).resetAll();
  await expect(migrateLegacyState(db)).resolves.toBe("skipped");

  expect(await db.profile.count()).toBe(0);
  expect(await db.lists.count()).toBe(0);
  expect(await db.items.count()).toBe(0);
  expect(await db.progress.count()).toBe(0);
  expect(await db.settings.get("legacyMigrationV1")).toMatchObject({ value: "done" });
});
