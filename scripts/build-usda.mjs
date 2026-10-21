// Builds public/foods/usda.json from the USDA FoodData Central "SR Legacy"
// CSV download (public domain): https://fdc.nal.usda.gov/download-datasets
// Usage: node scripts/build-usda.mjs <path to unzipped SR Legacy CSV folder>
//
// Output rows: [fdc_id, name, category_id, kcal, protein, carbs, fat, portions,
//               fiber, sugar, saturated fat, sodium_mg]
// Nutrients are per 100 g (null when USDA has no value); portions are [label, grams].
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) throw new Error('Pass the SR Legacy CSV folder')

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') field += '"', i++
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') row.push(field), (field = '')
    else if (ch === '\n') row.push(field), rows.push(row), (row = []), (field = '')
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) row.push(field), rows.push(row)
  const [header, ...body] = rows
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

const read = (f) => parseCsv(readFileSync(join(dir, f), 'utf8'))
// Baby foods, regional native foods, and lab QC samples aren't useful here.
const SKIP_CATEGORIES = new Set(['3', '24', '27'])
const NUTRIENTS = { 1008: 'kcal', 1003: 'p', 1005: 'c', 1004: 'f', 1079: 'fiber', 2000: 'sugar', 1258: 'sat', 1093: 'na' }

const units = Object.fromEntries(read('measure_unit.csv').map((u) => [u.id, u.name]))
const foods = new Map()
for (const f of read('food.csv')) {
  if (SKIP_CATEGORIES.has(f.food_category_id)) continue
  foods.set(f.fdc_id, { id: Number(f.fdc_id), name: f.description, cat: Number(f.food_category_id), kcal: null, p: 0, c: 0, f: 0, fiber: null, sugar: null, sat: null, na: null, portions: [] })
}
for (const n of read('food_nutrient.csv')) {
  const key = NUTRIENTS[n.nutrient_id]
  const food = foods.get(n.fdc_id)
  if (key && food) food[key] = Math.round(Number(n.amount) * 10) / 10
}
for (const p of read('food_portion.csv')) {
  const food = foods.get(p.fdc_id)
  const g = Number(p.gram_weight)
  if (!food || !(g > 0)) continue
  const unit = units[p.measure_unit_id]
  const label = [p.amount && Number(p.amount) !== 0 ? Number(p.amount) : '', unit && unit !== 'undetermined' ? unit : '', p.portion_description, p.modifier]
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+,/g, ',')
  if (label && food.portions.length < 5) food.portions.push([label, Math.round(g * 10) / 10])
}

const rows = [...foods.values()]
  .filter((f) => f.kcal !== null)
  .map((f) => [f.id, f.name, f.cat, f.kcal, f.p, f.c, f.f, f.portions, f.fiber, f.sugar, f.sat, f.na])
mkdirSync('public/foods', { recursive: true })
writeFileSync('public/foods/usda.json', JSON.stringify(rows))
console.log(`Wrote ${rows.length} foods`)
