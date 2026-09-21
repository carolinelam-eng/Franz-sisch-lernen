import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: { sourcemap: true },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: false,
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        runtimeCaching: [],
      },
    }),
  ],
});
