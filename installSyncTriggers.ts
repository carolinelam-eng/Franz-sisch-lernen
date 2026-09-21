import type { ContentSync } from "../content/contentSync";

/** Browser lifecycle hooks only. Capacitor native resume hooks are added in Phase 5. */
export function installSyncTriggers(
  contentSync: ContentSync,
  browserWindow: Window = window,
  browserDocument: Document = document,
): () => void {
  const onOnline = (): void => { void contentSync.sync("online"); };
  const onVisibilityChange = (): void => {
    if (browserDocument.visibilityState === "visible") void contentSync.sync("resume");
  };

  browserWindow.addEventListener("online", onOnline);
  browserDocument.addEventListener("visibilitychange", onVisibilityChange);
  void contentSync.sync("startup");

  return () => {
    browserWindow.removeEventListener("online", onOnline);
    browserDocument.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
