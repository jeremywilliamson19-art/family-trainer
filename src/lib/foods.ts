// Finding foods: the bundled USDA list (generic foods, offline) and
// Open Food Facts (branded foods and barcodes, online, no key needed).
import { COMMON_FOODS, type CommonFood } from './commonFoods'
import type { Food } from './types'

type UsdaRow = [id: number, name: string, cat: number, kcal: number, p: number, c: number, f: number, portions: [string, number][]]

let usda: Promise<UsdaRow[]> | null = null

/** Loads the USDA list once (cached by the service worker for offline use). */
export function loadUsda(): Promise<UsdaRow[]> {
  usda ??= fetch(`${import.meta.env.BASE_URL}foods/usda.json`)
    .then((r) => r.json())
    .catch((e) => {
      usda = null
      throw e
    })
  return usda
}

/** A USDA food expressed per its first household portion (or 100 g). */
export function usdaFood(r: UsdaRow): Food {
  const [id, name, cat, kcal, p, c, f, portions] = r
  const [label, g] = portions[0] ?? ['100 g', 100]
  const k = g / 100
  const r1 = (v: number) => Math.round(v * k * 10) / 10
  return {
    id: `usda:${id}`,
    source: 'usda',
    name,
    serving_label: label,
    serving_g: g,
    kcal: r1(kcal),
    protein: r1(p),
    carbs: r1(c),
    fat: r1(f),
    category: cat,
    portions: [['100 g', 100], ...portions],
  }
}

function words(s: string) {
  return s.toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean)
}

/**
 * Scores USDA names against the query: every word must appear. Matches in the
 * first comma-separated part ("Chicken, ...") and shorter names rank higher.
 */
export function scoreName(name: string, qWords: string[]): number {
  const lower = name.toLowerCase()
  const head = lower.split(',')[0]
  let score = 0
  for (const w of qWords) {
    const i = lower.indexOf(w)
    if (i < 0) return -1
    score += head.includes(w) ? 10 : 3
    if (i === 0) score += 5
  }
  // Prefer plain, home-cooked forms over processed and restaurant items,
  // unless the search itself asks for them.
  const asked = (re: RegExp) => qWords.some((w) => re.test(w))
  if (/\bcooked\b|\bgrilled\b|\broasted\b|\bboiled\b|\bbaked\b/.test(lower)) score += 3
  else if (/\braw\b/.test(lower)) score += 2
  if (/meat only|skinless|boneless|whole|plain|nonfat|lean/.test(lower)) score += 2
  if (!asked(/bread|deli|nugget|tender|frozen|fried|fast|restaurant|sliced|canned/) &&
      /breaded|deli|roll\b|sliced|prepackaged|fat-free|flavou?r|nuggets|tenders|fast foods|restaurant|frozen|with added solution|imitation|babyfood|\bmix\b|dry mix/.test(lower)) {
    score -= 6
  }
  return score - name.length / 40
}

/** An everyday food: the USDA entry under its friendly name and usual portion. */
export function commonFood(c: CommonFood, row: UsdaRow): Food {
  const base = usdaFood(row)
  const portions = c.custom ? [c.custom, ...(base.portions ?? [])] : (base.portions ?? [])
  const [label, g] = c.custom ?? portions.find(([l]) => c.portion && l.includes(c.portion)) ?? row[7][0] ?? ['100 g', 100]
  const k = g / 100
  const r1 = (v: number) => Math.round(v * k * 10) / 10
  return { ...base, name: c.name, serving_label: label, serving_g: g, kcal: r1(row[3]), protein: r1(row[4]), carbs: r1(row[5]), fat: r1(row[6]), portions }
}

/** Every query word must start a word of the name or aliases ("egg" finds "eggs"). */
function matchesCommon(c: CommonFood, q: string[]) {
  const hay = words(`${c.name} ${c.aka ?? ''}`)
  return q.every((w) => hay.some((h) => h.startsWith(w)))
}

export async function searchUsda(query: string, limit = 25): Promise<Food[]> {
  const q = words(query)
  if (!q.length) return []
  const rows = await loadUsda()
  const byId = new Map(rows.map((r) => [r[0], r]))
  const common = COMMON_FOODS.filter((c) => byId.has(c.usda) && matchesCommon(c, q))
    .slice(0, Math.min(8, limit))
    .map((c) => commonFood(c, byId.get(c.usda)!))
  const taken = new Set(common.map((f) => f.id))
  const rest = rows
    .map((r) => [r, scoreName(r[1], q)] as const)
    .filter(([r, s]) => s >= 0 && !taken.has(`usda:${r[0]}`))
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, limit - common.length))
    .map(([r]) => usdaFood(r))
  return [...common, ...rest]
}

// ---------------------------------------------------------------------------
// Open Food Facts
// ---------------------------------------------------------------------------

const OFF = 'https://world.openfoodfacts.org'
const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity'

interface OffProduct {
  code: string
  product_name?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number>
}

/** Converts an OFF product; null when it has no usable nutrition data. */
export function offFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {}
  const name = p.product_name?.trim()
  if (!name) return null
  const servingG = Number(p.serving_quantity) || null
  const per = (key: string): number | null => {
    if (servingG && n[`${key}_serving`] !== undefined) return Number(n[`${key}_serving`])
    if (n[`${key}_100g`] !== undefined) return Number(n[`${key}_100g`]) * ((servingG ?? 100) / 100)
    return null
  }
  const kcal = per('energy-kcal') ?? (per('energy') !== null ? per('energy')! / 4.184 : null)
  const protein = per('proteins')
  if (kcal === null && protein === null) return null
  const r1 = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10)
  return {
    id: `off:${p.code}`,
    source: 'off',
    name,
    brand: p.brands?.split(',')[0]?.trim() || null,
    barcode: p.code,
    serving_label: servingG ? p.serving_size?.trim() || `${servingG} g` : '100 g',
    serving_g: servingG ?? 100,
    kcal: r1(kcal),
    protein: r1(protein) ?? 0,
    carbs: r1(per('carbohydrates')),
    fat: r1(per('fat')),
  }
}

/** Looks up a barcode. Returns null when not found (offer a custom food). */
export async function lookupBarcode(code: string): Promise<Food | null> {
  // Codes arrive normalized to 13 digits; some products are filed under the 12-digit UPC.
  const tries = code.length === 13 && code.startsWith('0') ? [code, code.slice(1)] : [code]
  for (const c of tries) {
    const res = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(c)}.json?fields=${OFF_FIELDS}`)
    if (res.status === 404) continue
    if (!res.ok) throw new Error('Barcode lookup failed. Check your connection.')
    const j = (await res.json()) as { status?: number; product?: OffProduct }
    if (j.status === 1 && j.product) return offFood({ ...j.product, code })
  }
  return null
}

/** Branded food search. Slower than USDA; call debounced. */
export async function searchBranded(query: string, signal?: AbortSignal): Promise<Food[]> {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=20&countries_tags_en=united-states&fields=${OFF_FIELDS}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Brand search is unavailable right now.')
  const j = (await res.json()) as { products?: OffProduct[] }
  return (j.products ?? []).map(offFood).filter((f): f is Food => f !== null)
}
