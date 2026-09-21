import "../styles.css";
import { startApp } from "./app";
import { installPwaUpdatePrompt } from "./pwa";

void startApp(document.querySelector<HTMLElement>("#app-main"));
installPwaUpdatePrompt(document.querySelector<HTMLElement>("#update-status"));
