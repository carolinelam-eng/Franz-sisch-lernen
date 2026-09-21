import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const projectFile = (path: string): string => resolve(process.cwd(), path);

test("manifest uses relative GitHub Pages paths and standalone display", async () => {
  const manifest = JSON.parse(await readFile(projectFile("public/manifest.webmanifest"), "utf8"));
  expect(manifest.start_url).toBe("./");
  expect(manifest.scope).toBe("./");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((icon: { sizes?: string }) => icon.sizes === "512x512")).toBe(true);
});

test("PWA configuration generates the app shell without API runtime caches", async () => {
  const config = await readFile(projectFile("vite.config.ts"), "utf8");
  expect(config).toContain('navigateFallback: "index.html"');
  expect(config).toContain("runtimeCaching: []");
  expect(config).toContain('registerType: "autoUpdate"');
});

test("index contains manifest, main landmark and five navigation destinations", async () => {
  const html = await readFile(projectFile("index.html"), "utf8");
  expect(html).toMatch(/rel="manifest" href="\.\/manifest\.webmanifest"/);
  expect(html).toMatch(/<main id="app-main"/);
  expect((html.match(/class="nav-item/g) ?? [])).toHaveLength(5);
});

test("Vite entry points at the typed application", async () => {
  const html = await readFile(projectFile("index.html"), "utf8");
  const app = await readFile(projectFile("src/app.ts"), "utf8");
  const store = await readFile(projectFile("src/storage/legacyStore.ts"), "utf8");
  expect(html).toMatch(/src="\/src\/main\.ts"/);
  expect(app).toMatch(/from '\.\/demoData'/);
  expect(app).toMatch(/from '\.\/domain\/learning'/);
  expect(app).toMatch(/from '\.\/storage\/legacyStore'/);
  expect(store).toMatch(/from ["']\.\.\/demoData["']/);
});
