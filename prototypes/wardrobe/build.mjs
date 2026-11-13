import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const output = new URL('../../public/prototypes/wardrobe/', root);
await mkdir(output, { recursive: true });
const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
// JSON stays inert even if a future product title contains an HTML closing tag.
const json = JSON.stringify(catalog).replaceAll('<', '\\u003c');
const template = await readFile(new URL('src/template.html', root), 'utf8');
if (template.split('__CATALOG__').length !== 2) throw new Error('Expected one catalog slot');
await writeFile(new URL('index.html', output), template.replace('__CATALOG__', json));
const sdkCSS = await readFile(new URL('node_modules/@ui-sdk/core/dist/web.css', root), 'utf8');
const appCSS = await readFile(new URL('src/app.css', root), 'utf8');
await writeFile(new URL('cloak-wardrobe.css', output), '@layer ui-sdk;\n' + sdkCSS + '\n' + appCSS);
await build({
  entryPoints: [fileURLToPath(new URL('src/app.ts', root))],
  outfile: fileURLToPath(new URL('cloak-wardrobe.js', output)),
  bundle: true, format: 'esm', target: 'es2022', minify: true, legalComments: 'inline',
});
console.log('Built static wardrobe: public/prototypes/wardrobe/index.html');
