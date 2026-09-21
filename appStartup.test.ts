import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SoleilDatabase } from "../../src/storage/db";
import type { ContentClient } from "../../src/content/contentClient";
import type { PublishedCollection } from "../../src/content/types";

let db: SoleilDatabase;

beforeEach(async () => {
  db = new SoleilDatabase();
  await db.delete();
  db = new SoleilDatabase();
  await db.profile.put({ id: "local", learningName: "Camille", xp: 240, streak: 3, lastActiveDate: "2026-09-19" });
  await db.lists.put({
    id: "remote-list",
    source: "published",
    name: "Les animaux",
    description: "Tiere",
    contentVersion: 2,
    active: true,
    updatedAt: "2026-09-20T10:00:00.000Z",
  });
  document.body.innerHTML = `
    <div id="network-status" hidden></div>
    <main id="app-main"></main>
    <nav class="bottom-nav"></nav>
    <div id="toast" hidden></div>
  `;
});

afterEach(async () => {
  db.close();
  await db.delete();
});

test("hydrates the initial screen from IndexedDB before rendering", async () => {
  const { startApp } = await import("../../src/app");

  await startApp(document.querySelector<HTMLElement>("#app-main"), {
    db,
    currentUrl: new URL("https://app.example/"),
  });

  expect(document.body.textContent).toContain("Bonjour, Camille");
  expect(document.body.textContent).toContain("Les animaux");
});

test("treats published lists as read-only learner content", async () => {
  const { startApp } = await import("../../src/app");
  await startApp(document.querySelector<HTMLElement>("#app-main"), {
    db,
    currentUrl: new URL("https://app.example/"),
  });

  document.querySelector<HTMLButtonElement>('[data-action="open-list"]')?.click();
  await vi.waitFor(() => expect(document.body.textContent).toContain("Lernrunde starten"));
  expect(document.querySelector('[data-action="edit-list"]')).toBeNull();
  expect(document.querySelector('[data-action="delete-list"]')).toBeNull();
  expect(document.body.textContent).toContain("Diese veröffentlichte Liste ist schreibgeschützt");
});

test("connects a shared collection link before showing the lists", async () => {
  const key = "abcdefghijklmnopqrstuvwxyzABCDEF";
  const contentClient: ContentClient = {
    fetchCollection: vi.fn().mockResolvedValue({
      collectionId: "class-7b",
      version: 3,
      publishedAt: "2026-09-20T11:00:00.000Z",
      lists: [{
        id: "unit-2",
        name: "La famille",
        description: "Familie",
        version: 1,
        updatedAt: "2026-09-20T11:00:00.000Z",
        items: [],
      }],
    }),
  };
  const replaceUrl = vi.fn();
  const { startApp } = await import("../../src/app");

  await startApp(document.querySelector<HTMLElement>("#app-main"), {
    db,
    contentClient,
    currentUrl: new URL(`https://app.example/?collection=${key}`),
    replaceUrl,
  });

  expect(document.body.textContent).toContain("La famille");
  expect(document.body.textContent).toContain("Vokabellisten sind verbunden");
  expect(replaceUrl).toHaveBeenCalledWith("/");
  expect(await db.settings.get("collectionSubscription")).toMatchObject({ value: key });
});

test("keeps the current route and progress when an open published list is withdrawn", async () => {
  const key = "abcdefghijklmnopqrstuvwxyzABCDEF";
  await db.items.put({
    id: "remote-word",
    listId: "remote-list",
    french: "le chat",
    german: "die Katze",
    example: "",
    imageUrl: null,
    active: true,
  });
  await db.progress.put({
    itemId: "remote-word",
    direction: "fr-de",
    attempts: 4,
    errors: 1,
    correctStreak: 2,
    lastReviewedAt: "2026-09-20T10:30:00.000Z",
  });
  await db.settings.bulkPut([
    { key: "collectionSubscription", value: key },
    { key: "collectionId", value: "class-7b" },
    { key: "collectionVersion", value: "2" },
  ]);
  let resolveFetch!: (snapshot: PublishedCollection) => void;
  const pending = new Promise<PublishedCollection>((resolve) => { resolveFetch = resolve; });
  const contentClient: ContentClient = { fetchCollection: vi.fn(() => pending) };
  const { startApp } = await import("../../src/app");

  await startApp(document.querySelector<HTMLElement>("#app-main"), {
    db,
    contentClient,
    currentUrl: new URL("https://app.example/"),
  });
  document.querySelector<HTMLButtonElement>('[data-action="open-list"]')?.click();
  await vi.waitFor(() => expect(document.body.textContent).toContain("le chat"));

  resolveFetch({
    collectionId: "class-7b",
    version: 3,
    publishedAt: "2026-09-20T12:00:00.000Z",
    lists: [],
  });

  await vi.waitFor(() => expect(document.body.textContent).toContain("Diese Liste wurde zurückgezogen"));
  expect(document.body.textContent).toContain("Zurück zu den Listen");
  expect(await db.progress.get(["remote-word", "fr-de"])).toMatchObject({ attempts: 4, errors: 1 });
});
