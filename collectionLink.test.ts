import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PublishedCollection } from "../../src/content/types";
import type { ContentClient } from "../../src/content/contentClient";
import {
  connectCollectionFromUrl,
  readCollectionKey,
  removeCollectionKey,
} from "../../src/content/collectionLink";
import { SoleilDatabase } from "../../src/storage/db";

const validKey = "abcdefghijklmnopqrstuvwxyzABCDEF";
let db: SoleilDatabase;

const published: PublishedCollection = {
  collectionId: "class-7b",
  version: 1,
  publishedAt: "2026-09-20T10:00:00.000Z",
  lists: [{
    id: "unit-1",
    name: "Unité 1",
    description: "Schule",
    version: 1,
    updatedAt: "2026-09-20T10:00:00.000Z",
    items: [{ id: "bonjour", listId: "unit-1", french: "bonjour", german: "guten Tag", example: "", imageUrl: null }],
  }],
};

beforeEach(() => {
  db = new SoleilDatabase(`link-${crypto.randomUUID()}`);
});

afterEach(async () => {
  vi.restoreAllMocks();
  db.close();
  await db.delete();
});

test("extracts a valid shared collection key", () => {
  expect(readCollectionKey(new URL(`https://app.example/?collection=${validKey}`))).toBe(validKey);
});

test.each([
  "https://app.example/",
  "https://app.example/?collection=short",
  `https://app.example/?collection=${"a".repeat(87)}`,
  "https://app.example/?collection=invalid%20key%21",
])("rejects missing or malformed collection keys", (address) => {
  expect(readCollectionKey(new URL(address))).toBeNull();
});

test("removes only the collection key while preserving other URL parts", () => {
  const url = new URL(`https://app.example/path?collection=${validKey}&view=lists#today`);
  expect(removeCollectionKey(url)).toBe("/path?view=lists#today");
});

test("stores and cleans the key only after content was merged", async () => {
  const client: ContentClient = { fetchCollection: vi.fn().mockResolvedValue(published) };
  const replaceUrl = vi.fn();

  await expect(connectCollectionFromUrl({
    url: new URL(`https://app.example/?collection=${validKey}`),
    db,
    client,
    replaceUrl,
  })).resolves.toBe("connected");

  expect(await db.settings.get("collectionSubscription")).toEqual({ key: "collectionSubscription", value: validKey });
  expect(await db.lists.get("unit-1")).toMatchObject({ active: true, source: "published" });
  expect(replaceUrl).toHaveBeenCalledWith("/");
});

test("keeps an existing subscription when the server lookup fails", async () => {
  const oldKey = "0123456789abcdefghijklmnopqrstuv";
  await db.settings.put({ key: "collectionSubscription", value: oldKey });
  const client: ContentClient = { fetchCollection: vi.fn().mockRejectedValue(new Error(`failed ${validKey}`)) };
  const replaceUrl = vi.fn();
  const statuses: string[] = [];
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

  await expect(connectCollectionFromUrl({
    url: new URL(`https://app.example/?collection=${validKey}`),
    db,
    client,
    replaceUrl,
    onStatus: (status) => statuses.push(status.message),
  })).resolves.toBe("failed");

  expect(await db.settings.get("collectionSubscription")).toEqual({ key: "collectionSubscription", value: oldKey });
  expect(replaceUrl).not.toHaveBeenCalled();
  expect(statuses.join(" ")).not.toContain(validKey);
  expect(consoleSpy).not.toHaveBeenCalled();
});
