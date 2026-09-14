import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('manifest uses relative GitHub Pages paths and standalone display', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
});

test('service worker pre-caches the app shell', async () => {
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const asset of ['./index.html', './styles.css', './js/app.js', './js/learning.js', './js/store.js']) {
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('index contains manifest, main landmark and five navigation destinations', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /<main id="app-main"/);
  assert.equal((html.match(/class="nav-item/g) ?? []).length, 5);
});
