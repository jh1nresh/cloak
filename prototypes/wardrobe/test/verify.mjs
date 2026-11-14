import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const output = new URL('../../public/prototypes/wardrobe/', root);
const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
assert.equal(catalog.count, 12);
assert.equal(catalog.items.length, 12);
assert.equal(new Set(catalog.items.map(p => p.id)).size, 12);
assert.equal(new Set(catalog.items.map(p => p.variant_id)).size, 12);
const shops = new Map();
for (const [index, product] of catalog.items.entries()) {
  shops.set(product.store_id, (shops.get(product.store_id) || 0) + 1);
  assert.equal(new URL(product.source_url).protocol, 'https:');
  for (const [field, expected] of [['result', `wardrobe-assets/look-${index}.webp`], ['garment', `wardrobe-assets/garment-${index}.jpg`]]) {
    assert.equal(product[field], expected);
    assert.ok((await stat(new URL(expected, output))).size > 0);
  }
}
assert.deepEqual([...shops.values()].sort(), [4, 4, 4]);
const html = await readFile(new URL('index.html', output), 'utf8');
const embedded = JSON.parse(html.match(/<script id="catalog" type="application\/json">(.*?)<\/script>/s)[1]);
assert.deepEqual(embedded, catalog);
assert.ok(html.includes("connect-src 'none'"));
assert.ok(!html.includes('__CATALOG__'));
assert.equal((html.match(/id="baseImage"/g) || []).length, 1);
assert.ok(html.indexOf('id="baseImage"') < html.indexOf('<ui-carousel-viewport'));
for (const asset of ['base.jpg', 'upper-mask.svg']) assert.ok((await stat(new URL('wardrobe-assets/' + asset, output))).size > 0);
for (const asset of ['favicon.svg', 'cloak-wardrobe.js', 'cloak-wardrobe.css', 'cloak-ui-LICENSE.txt']) assert.ok((await stat(new URL(asset, output))).size > 0);
const mask = await readFile(new URL('wardrobe-assets/upper-mask.svg', output), 'utf8');
assert.ok(mask.includes('viewBox="0 0 720 1280"'));
console.log('PASS: 12 distinct products, 3 shops, 26 image/mask assets, fixed base, catalog round trip, CSP and static bundle');
