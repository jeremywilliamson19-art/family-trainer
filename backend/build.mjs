// Bundles backend/src into backend/dist/Code.js for Apps Script.
import { build } from 'esbuild'
import { copyFileSync, mkdirSync } from 'node:fs'

const here = new URL('.', import.meta.url).pathname
mkdirSync(`${here}dist`, { recursive: true })
await build({
  entryPoints: [`${here}src/main.ts`],
  bundle: true,
  format: 'iife',
  globalName: 'FT',
  target: 'es2020',
  outfile: `${here}dist/Code.js`,
  legalComments: 'none',
  // Apps Script only sees top-level function declarations.
  footer: {
    js: [
      'function doGet(e) { return FT.doGet(e) }',
      'function doPost(e) { return FT.doPost(e) }',
      'function setup() { return FT.setup() }',
    ].join('\n'),
  },
})
copyFileSync(`${here}appsscript.json`, `${here}dist/appsscript.json`)
console.log('Built backend/dist/Code.js')
