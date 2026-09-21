import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

const projectRoot = process.cwd();
const dist = join(projectRoot, "dist");

beforeAll(() => {
  execFileSync("npm", ["run", "build"], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
    stdio: "pipe",
  });
}, 30_000);

describe("offline production build", () => {
  test("contains the installable app shell and generated service worker", () => {
    for (const file of ["index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "sw.js"]) {
      expect(existsSync(join(dist, file)), `${file} fehlt`).toBe(true);
    }

    const html = readFileSync(join(dist, "index.html"), "utf8");
    expect(html).toMatch(/(?:src|href)="\.\/[^"/]/);
    expect(html).not.toMatch(/(?:src|href)="\/(?!\/)/);
  });

  test("precaches the app shell without caching API responses", () => {
    const serviceWorkerFiles = readdirSync(dist).filter((file) => file.endsWith(".js") && (file === "sw.js" || file.startsWith("workbox-")));
    const serviceWorker = serviceWorkerFiles.map((file) => readFileSync(join(dist, file), "utf8")).join("\n");

    expect(serviceWorker).toContain("index.html");
    expect(serviceWorker).toContain("manifest.webmanifest");
    expect(serviceWorker).not.toContain("get_published_collection");
    expect(serviceWorker).not.toMatch(/supabase[^\s"']*\/rest\/v1/i);
  });

  test("does not publish environment files or privileged keys", () => {
    const files = readdirSync(dist, { recursive: true }).map(String);
    expect(files.some((file) => file === ".env" || file.startsWith(".env."))).toBe(false);
    const output = files
      .filter((file) => statSync(join(dist, file)).isFile() && !file.endsWith(".png"))
      .map((file) => readFileSync(join(dist, file), "utf8"))
      .join("\n");
    expect(output).not.toMatch(/service[_-]?role/i);
  });
});
