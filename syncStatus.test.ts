import { describe, expect, test, vi } from "vitest";
import { bindSyncRetry, renderSyncStatus } from "../../src/ui/syncStatus";
import type { SyncStatus } from "../../src/content/contentSync";

describe("renderSyncStatus", () => {
  test.each<[SyncStatus, string]>([
    [{ kind: "syncing" }, "Neue Listen werden geprüft …"],
    [{ kind: "current", syncedAt: "2026-09-20T12:30:00.000Z" }, "Zuletzt geprüft"],
    [{ kind: "updated", listCount: 3, syncedAt: "2026-09-20T12:30:00.000Z" }, "Neue Vokabellisten sind da"],
    [{ kind: "offline" }, "Offline – gespeicherte Listen sind verfügbar"],
    [{ kind: "error", retryable: true }, "Erneut versuchen"],
  ])("renders %s accessibly", (status, message) => {
    const html = renderSyncStatus(status);

    expect(html).toContain(message);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("abcdefghijklmnopqrstuvwxyzABCDEF");
  });

  test("stays silent when no collection is connected", () => {
    expect(renderSyncStatus({ kind: "not-connected" })).toBe("");
  });

  test("only offers retry for retryable errors", () => {
    expect(renderSyncStatus({ kind: "error", retryable: true })).toContain("sync-retry");
    expect(renderSyncStatus({ kind: "error", retryable: false })).not.toContain("sync-retry");
  });
});

test("bindSyncRetry invokes retry once and can be removed", async () => {
  const root = document.createElement("div");
  root.innerHTML = renderSyncStatus({ kind: "error", retryable: true });
  const retry = vi.fn().mockResolvedValue(undefined);
  const unbind = bindSyncRetry(root, retry);

  root.querySelector<HTMLButtonElement>(".sync-retry")?.click();
  await vi.waitFor(() => expect(retry).toHaveBeenCalledTimes(1));

  unbind();
  root.querySelector<HTMLButtonElement>(".sync-retry")?.click();
  expect(retry).toHaveBeenCalledTimes(1);
});
