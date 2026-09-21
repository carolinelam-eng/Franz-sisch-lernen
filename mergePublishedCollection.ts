import type { LocalList, LocalVocabItem } from "../domain/types";
import type { SoleilDatabase } from "../storage/db";
import type { MergeResult, PublishedCollection, PublishedItem, PublishedList } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function requireNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} darf nicht leer sein.`);
}

function validateItem(value: unknown, listId: string, seenItems: Set<string>): asserts value is PublishedItem {
  if (!isRecord(value)) throw new Error("Eine veröffentlichte Vokabel ist ungültig.");
  requireNonEmpty(value.id, "Vokabel-ID");
  if (seenItems.has(value.id)) throw new Error(`Vokabel-ID ${value.id} ist doppelt.`);
  seenItems.add(value.id);
  if (value.listId !== listId) throw new Error(`Die listId der Vokabel ${value.id} passt nicht zur Liste.`);
  requireNonEmpty(value.french, "Französisches Wort");
  requireNonEmpty(value.german, "Deutsche Übersetzung");
  if (typeof value.example !== "string") throw new Error("Der Beispielsatz ist ungültig.");
  if (value.imageUrl !== null && typeof value.imageUrl !== "string") throw new Error("Die Bildadresse ist ungültig.");
}

function validateList(value: unknown, seenLists: Set<string>, seenItems: Set<string>): asserts value is PublishedList {
  if (!isRecord(value)) throw new Error("Eine veröffentlichte Liste ist ungültig.");
  requireNonEmpty(value.id, "Listen-ID");
  if (seenLists.has(value.id)) throw new Error(`Listen-ID ${value.id} ist doppelt.`);
  seenLists.add(value.id);
  requireNonEmpty(value.name, "Listenname");
  if (typeof value.description !== "string") throw new Error("Die Listenbeschreibung ist ungültig.");
  if (!Number.isInteger(value.version) || (value.version as number) <= 0) throw new Error("Die Listenversion ist ungültig.");
  if (!isIsoTimestamp(value.updatedAt)) throw new Error("Der Aktualisierungszeitpunkt der Liste ist ungültig.");
  if (!Array.isArray(value.items)) throw new Error("Die Vokabeln der Liste sind ungültig.");
  value.items.forEach((item) => validateItem(item, value.id as string, seenItems));
}

export function validatePublishedCollection(value: unknown): asserts value is PublishedCollection {
  if (!isRecord(value)) throw new Error("Die veröffentlichte Sammlung ist ungültig.");
  requireNonEmpty(value.collectionId, "Sammlungs-ID");
  if (!Number.isInteger(value.version) || (value.version as number) <= 0) throw new Error("Die Sammlungsversion ist ungültig.");
  if (!isIsoTimestamp(value.publishedAt)) throw new Error("Der Veröffentlichungszeitpunkt ist ungültig.");
  if (!Array.isArray(value.lists)) throw new Error("Die Listen der Sammlung sind ungültig.");
  const seenLists = new Set<string>();
  const seenItems = new Set<string>();
  value.lists.forEach((list) => validateList(list, seenLists, seenItems));
}

export async function mergePublishedCollection(
  db: SoleilDatabase,
  snapshot: PublishedCollection,
): Promise<MergeResult> {
  validatePublishedCollection(snapshot);

  return db.transaction("rw", db.lists, db.items, db.settings, async () => {
    const lastCollectionId = (await db.settings.get("lastCollectionId"))?.value;
    const lastVersion = Number((await db.settings.get("lastCollectionVersion"))?.value ?? 0);
    const currentPublishedLists = (await db.lists.toArray()).filter((list) => list.source === "published");
    if (lastCollectionId === snapshot.collectionId && snapshot.version <= lastVersion) {
      return {
        changed: false,
        collectionVersion: lastVersion,
        activeListCount: currentPublishedLists.filter((list) => list.active).length,
      };
    }

    const allLists = await db.lists.toArray();
    const localListIds = new Set(allLists.filter((list) => list.source === "local").map((list) => list.id));
    const snapshotListIds = new Set(snapshot.lists.map((list) => list.id));
    const snapshotItems = snapshot.lists.flatMap((list) => list.items);
    const snapshotItemIds = new Set(snapshotItems.map((item) => item.id));
    const currentItems = await db.items.toArray();

    if (snapshot.lists.some((list) => localListIds.has(list.id))) {
      throw new Error("Eine veröffentlichte Liste kollidiert mit einer lokalen Liste.");
    }
    if (snapshotItems.some((item) => {
      const existing = currentItems.find((candidate) => candidate.id === item.id);
      return existing ? localListIds.has(existing.listId) : false;
    })) {
      throw new Error("Eine veröffentlichte Vokabel kollidiert mit einer lokalen Vokabel.");
    }

    const publishedListIds = new Set(currentPublishedLists.map((list) => list.id));
    const listsToWrite: LocalList[] = [
      ...currentPublishedLists
        .filter((list) => !snapshotListIds.has(list.id))
        .map((list) => ({ ...list, active: false })),
      ...snapshot.lists.map((list) => ({
        id: list.id,
        source: "published" as const,
        name: list.name.trim(),
        description: list.description.trim(),
        contentVersion: list.version,
        active: true,
        updatedAt: list.updatedAt,
      })),
    ];
    const itemsToWrite: LocalVocabItem[] = [
      ...currentItems
        .filter((item) => publishedListIds.has(item.listId) && !snapshotItemIds.has(item.id))
        .map((item) => ({ ...item, active: false })),
      ...snapshotItems.map((item) => ({
        id: item.id,
        listId: item.listId,
        french: item.french.trim(),
        german: item.german.trim(),
        example: item.example.trim(),
        imageUrl: item.imageUrl,
        active: true,
      })),
    ];

    if (listsToWrite.length) await db.lists.bulkPut(listsToWrite);
    if (itemsToWrite.length) await db.items.bulkPut(itemsToWrite);
    await db.settings.bulkPut([
      { key: "lastCollectionVersion", value: String(snapshot.version) },
      { key: "lastCollectionId", value: snapshot.collectionId },
      { key: "lastContentSyncAt", value: new Date().toISOString() },
    ]);

    return {
      changed: true,
      collectionVersion: snapshot.version,
      activeListCount: snapshot.lists.length,
    };
  });
}
