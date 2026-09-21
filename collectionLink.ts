import type { SoleilDatabase } from "../storage/db";
import { mergePublishedCollection } from "./mergePublishedCollection";
import type { ContentClient } from "./contentClient";

const COLLECTION_KEY = /^[A-Za-z0-9_-]{32,86}$/;

export interface ConnectionStatus {
  kind: "connecting" | "connected" | "failed";
  message: string;
}

interface ConnectOptions {
  url: URL;
  db: SoleilDatabase;
  client: ContentClient;
  replaceUrl: (cleanUrl: string) => void;
  onStatus?: (status: ConnectionStatus) => void;
  signal?: AbortSignal;
}

export function readCollectionKey(url: URL): string | null {
  const value = url.searchParams.get("collection");
  return value && COLLECTION_KEY.test(value) ? value : null;
}

export function removeCollectionKey(url: URL): string {
  const clean = new URL(url);
  clean.searchParams.delete("collection");
  return `${clean.pathname}${clean.search}${clean.hash}`;
}

export async function connectCollectionFromUrl({
  url,
  db,
  client,
  replaceUrl,
  onStatus = () => undefined,
  signal,
}: ConnectOptions): Promise<"no-link" | "connected" | "failed"> {
  const key = readCollectionKey(url);
  if (!key) return "no-link";
  onStatus({ kind: "connecting", message: "Sammlung wird verbunden …" });
  try {
    const snapshot = await client.fetchCollection(key, signal);
    await mergePublishedCollection(db, snapshot);
    await db.settings.put({ key: "collectionSubscription", value: key });
    replaceUrl(removeCollectionKey(url));
    onStatus({ kind: "connected", message: "Vokabellisten sind verbunden" });
    return "connected";
  } catch {
    onStatus({
      kind: "failed",
      message: "Verbindung fehlgeschlagen. Deine gespeicherten Listen bleiben verfügbar.",
    });
    return "failed";
  }
}
