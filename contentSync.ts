import type { SoleilDatabase } from "../storage/db";
import { ContentClientError, type ContentClient } from "./contentClient";
import { mergePublishedCollection } from "./mergePublishedCollection";

export type SyncStatus =
  | { kind: "not-connected" }
  | { kind: "syncing" }
  | { kind: "current"; syncedAt: string }
  | { kind: "updated"; listCount: number; syncedAt: string }
  | { kind: "offline" }
  | { kind: "error"; retryable: boolean };

export type SyncReason = "startup" | "resume" | "online" | "manual";

export interface ContentSync {
  sync(reason: SyncReason): Promise<SyncStatus>;
}

interface ContentSyncOptions {
  db: SoleilDatabase;
  client: ContentClient;
  onStatus?: (status: SyncStatus) => void;
  timeoutMs?: number;
}

export function createContentSync({ db, client, onStatus = () => undefined, timeoutMs = 10_000 }: ContentSyncOptions): ContentSync {
  let inFlight: Promise<SyncStatus> | null = null;

  const run = async (_reason: SyncReason): Promise<SyncStatus> => {
    const key = (await db.settings.get("collectionSubscription"))?.value;
    if (!key) {
      const status: SyncStatus = { kind: "not-connected" };
      onStatus(status);
      return status;
    }

    onStatus({ kind: "syncing" });
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const snapshot = await client.fetchCollection(key, controller.signal);
      const currentKey = (await db.settings.get("collectionSubscription"))?.value;
      if (currentKey !== key) {
        const status: SyncStatus = { kind: "not-connected" };
        onStatus(status);
        return status;
      }
      const result = await mergePublishedCollection(db, snapshot);
      const syncedAt = (await db.settings.get("lastContentSyncAt"))?.value ?? new Date().toISOString();
      const status: SyncStatus = result.changed
        ? { kind: "updated", listCount: result.activeListCount, syncedAt }
        : { kind: "current", syncedAt };
      onStatus(status);
      return status;
    } catch (error) {
      const offline = controller.signal.aborted
        || (typeof navigator !== "undefined" && !navigator.onLine)
        || (error instanceof ContentClientError && error.code === "network");
      const status: SyncStatus = offline
        ? { kind: "offline" }
        : { kind: "error", retryable: !(error instanceof ContentClientError) || error.code === "remote" };
      onStatus(status);
      return status;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  };

  return {
    sync(reason) {
      if (inFlight) return inFlight;
      inFlight = run(reason).finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
