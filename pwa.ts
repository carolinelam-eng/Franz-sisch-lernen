import { registerSW } from "virtual:pwa-register";

export function installPwaUpdatePrompt(root: HTMLElement | null): void {
  if (!root) return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      root.innerHTML = '<span>Eine neue Version ist verfügbar.</span><button type="button" class="update-button">App aktualisieren</button>';
      root.hidden = false;
    },
    onOfflineReady() {
      root.textContent = "Die App ist jetzt offline verfügbar.";
      root.hidden = false;
      window.setTimeout(() => { root.hidden = true; }, 3000);
    },
  });

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".update-button")) void updateSW(true);
  });
}
