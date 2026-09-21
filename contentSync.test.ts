import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ContentClient } from "../../src/content/contentClient";
import { ContentClientError } from "../../src/content/contentClient";
import { createContentSync } from "../../src/content/contentSync";
import type { PublishedCollection } from "../../src/content/types";
import { SoleilDatabase } from "../../src/storage/db";
import { createLocalRepository } from "../../src/storage/repository";

let db: SoleilDatabase;
const key = "abcdefghijklmnopqrstuvwxyzABCDEF";
const snapshot: PublishedCollection = {
  collectionId: "class-7b",
  version: 2,
  publishedAt: "2026-09-20T10:00:00.000Z",
  lists: [{
    id: "unit-2",
    name: "Unité 2",
    description: "Familie",
    version: 1,
    updatedAt: "2026-09-20T10:00:00.000Z",
    items: [],
  }],
};

beforeEach(() => {
  db = new SoleilDatabase(`sync-${crypto.randomUUID()}`);
});

afterEach(async () => {
  vi.useRealTimers();
  db.close();
  await db.delete();
});

test("coalesces simultaneous sync calls into one request and one promise", async () => {
  await db.settings.put({ key: "collectionSubscription", value: key });
  let resolveFetch!: (value: PublishedCollection) => void;
  const pending = new Promise<PublishedCollection>((resolve) => { resolveFetch = resolve; });
  const fetchCollection = vi.fn(() => pending);
  const sync = createContentSync({ db, client: { fetchCollection } });

  const first = sync.sync("startup");
  const second = sync.sync("resume");

  expect(second).toBe(first);
  await vi.waitFor(() => expect(fetchCollection).toHaveBeenCalledTimes(1));
  resolveFetch(snapshot);
  await expect(first).resolves.toMatchObject({ kind: "updated", listCount: 1 });
});

test("does not restore content when a reset removes the subscription during a request", async () => {
  await db.settings.put({ key: "collectionSubscription", value: key });
  let resolveFetch!: (value: PublishedCollection) => void;
  const pending = new Promise<PublishedCollection>((resolve) => { resolveFetch = resolve; });
  const fetchCollection = vi.fn(() => pending);
  const sync = createContentSync({ db, client: { fetchCollection } });

  const result = sync.sync("startup");
  await vi.waitFor(() => expect(fetchCollection).toHaveBeenCalledTimes(1));
  await createLocalRepository(db).resetAll();
  resolveFetch(snapshot);

  await expect(result).resolves.toEqual({ kind: "not-connected" });
  expect(await db.lists.count()).toBe(0);
  expect(await db.items.count()).toBe(0);
  expect(await db.settings.toArray()).toEqual([{ key: "legacyMigrationV1", value: "done" }]);
});

test("returns not-connected without making a request", async () => {
  const fetchCollection = vi.fn();
  const sync = createContentSync({ db, client: { fetchCollection } as ContentClient });

  await expect(sync.sync("startup")).resolves.toEqual({ kind: "not-connected" });
  expect(fetchCollection).not.toHaveBeenCalled();
});

test("returns updated for a newer snapshot and current for the same version", async () => {
  await db.settings.put({ key: "collectionSubscription", value: key });
  const client: ContentClient = { fetchCollection: vi.fn().mockResolvedValue(snapshot) };
  const sync = createContentSync({ db, client });

  await expect(sync.sync("startup")).resolves.toMatchObject({ kind: "updated", listCount: 1 });
  const settingsBefore = await db.settings.toArray();
  await expect(sync.sync("manual")).resolves.toMatchObject({ kind: "current" });
  expect(await db.settings.toArray()).toEqual(settingsBefore);
});

test("maps network failure to offline and leaves cached content unchanged", async () => {
  await db.settings.put({ key: "collectionSubscription", value: key });
  await db.lists.put({
    id: "cached",
    source: "published",
    name: "Gespeichert",
    description: "",
    contentVersion: 1,
    active: true,
    updatedAt: "2026-09-19T10:00:00.000Z",
  });
  const before = await db.lists.toArray();
  const fetchCollection = vi.fn().mockRejectedValue(new ContentClientError("network"));
  const sync = createContentSync({ db, client: { fetchCollection } });

  await expect(sync.sync("online")).resolves.toEqual({ kind: "offline" });
  expect(await db.lists.toArray()).toEqual(before);
  expect(fetchCollection).toHaveBeenCalledTimes(1);
});

test("aborts after ten seconds without starting a retry loop", async () => {
  await db.settings.put({ key: "collectionSubscription", value: key });
  const fetchCollection = vi.fn((_key: string, signal?: AbortSignal) => new Promise<PublishedCollection>((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new ContentClientError("network")), { once: true });
  }));
  const sync = createContentSync({ db, client: { fetchCollection }, timeoutMs: 10 });

  const result = sync.sync("startup");
  await expect(result).resolves.toEqual({ kind: "offline" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(fetchCollection).toHaveBeenCalledTimes(1);
});
