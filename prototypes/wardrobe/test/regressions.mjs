import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { transform } from 'esbuild';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
catalog.items[0].title = '$& $` $\' </script><script>dummy</script>';
const template = await readFile(new URL('src/template.html', root), 'utf8');
const writes = new Map();
// Run the actual build script with in-memory I/O; bundling is checked separately.
const buildURL = new URL('build.mjs', root);
const source = (await readFile(buildURL, 'utf8'))
  .replace(/^import .*;$/gm, '')
  .replaceAll('import.meta.url', JSON.stringify(buildURL.href));
await vm.runInNewContext(`(async () => {${source}})()`, {
  URL, fileURLToPath, console: { log() {} }, mkdir: async () => {}, build: async () => {},
  readFile: async url => url.pathname.endsWith('catalog.json') ? JSON.stringify(catalog)
    : url.pathname.endsWith('template.html') ? template : '',
  writeFile: async (url, data) => writes.set(url.pathname, data),
});
const html = [...writes].find(([path]) => path.endsWith('/index.html'))[1];
const embedded = JSON.parse(html.match(/<script id="catalog" type="application\/json">(.*?)<\/script>/s)[1]);
assert.deepEqual(embedded, catalog);
assert.ok(!html.includes('</script><script>dummy'));

// Exercise the actual cache function with deterministic image decode outcomes.
const app = await readFile(new URL('src/app.ts', root), 'utf8');
const start = app.indexOf('const warmed='), end = app.indexOf('async function dress');
assert.ok(start >= 0 && end > start);
const cache = (await transform(app.slice(start, end), { loader: 'ts' })).code;
let attempts = 0;
const context = vm.createContext({ Image: class {
  decode() { attempts++; return attempts === 1 ? Promise.reject(new Error('dummy decode failure')) : Promise.resolve(); }
} });
vm.runInContext(cache + ';globalThis.warm = warm;', context);
const product = { result: 'dummy.webp' };
const failed = context.warm(product);
assert.equal(context.warm(product), failed, 'concurrent loads share a promise');
await assert.rejects(failed, /dummy decode failure/);
const retry = context.warm(product);
await retry;
assert.equal(attempts, 2, 'a rejected load is retried');
assert.equal(context.warm(product), retry, 'successful loads stay cached');
assert.equal(attempts, 2);
console.log('PASS: real build preserves replacement tokens/inert JSON; image failure retries and successful cache is reused');
