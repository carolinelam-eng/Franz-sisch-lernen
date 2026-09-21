import type { SyncStatus } from "../content/contentSync";

function formattedTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "vor Kurzem";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function renderSyncStatus(status: SyncStatus): string {
  if (status.kind === "not-connected") return "";

  let content = "";
  if (status.kind === "syncing") content = "Neue Listen werden geprüft …";
  if (status.kind === "current") content = `Zuletzt geprüft: ${formattedTime(status.syncedAt)} Uhr`;
  if (status.kind === "updated") content = "Neue Vokabellisten sind da";
  if (status.kind === "offline") content = "Offline – gespeicherte Listen sind verfügbar";
  if (status.kind === "error") {
    content = status.retryable
      ? 'Listen konnten nicht geprüft werden. <button type="button" class="sync-retry">Erneut versuchen</button>'
      : "Listen konnten zurzeit nicht geprüft werden.";
  }

  return `<div class="sync-banner sync-banner--${status.kind}" role="status" aria-live="polite">${content}</div>`;
}

export function bindSyncRetry(root: HTMLElement, retry: () => Promise<unknown>): () => void {
  const onClick = async (event: Event): Promise<void> => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>(".sync-retry");
    if (!button || !root.contains(button) || button.disabled) return;
    button.disabled = true;
    try {
      await retry();
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}
