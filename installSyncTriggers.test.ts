import { afterEach, expect, test, vi } from "vitest";
import type { ContentSync } from "../../src/content/contentSync";
import { installSyncTriggers } from "../../src/lifecycle/installSyncTriggers";

afterEach(() => {
  vi.restoreAllMocks();
});

test("syncs on startup, online and visible resume but not while hidden", () => {
  const sync = vi.fn().mockResolvedValue({ kind: "current", syncedAt: "2026-09-20T10:00:00.000Z" });
  const coordinator: ContentSync = { sync };
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

  const teardown = installSyncTriggers(coordinator);
  window.dispatchEvent(new Event("online"));
  document.dispatchEvent(new Event("visibilitychange"));
  visibility.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));

  expect(sync.mock.calls).toEqual([["startup"], ["online"], ["resume"]]);

  teardown();
  window.dispatchEvent(new Event("online"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(sync).toHaveBeenCalledTimes(3);
});

test("does not create a polling interval", () => {
  const interval = vi.spyOn(window, "setInterval");
  const coordinator: ContentSync = { sync: vi.fn().mockResolvedValue({ kind: "not-connected" }) };

  const teardown = installSyncTriggers(coordinator);

  expect(interval).not.toHaveBeenCalled();
  teardown();
});
