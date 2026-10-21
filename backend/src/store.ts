// Each table is a sheet tab with columns: id | json | updated_at.
// Small household data, so whole tables are read once per request and cached.

export type TableName =
  | 'members'
  | 'member_private'
  | 'member_settings'
  | 'child_guardian_settings'
  | 'invites'
  | 'login_codes'
  | 'pairing_codes'
  | 'sessions'
  | 'push_subscriptions'
  | 'targets'
  | 'foods'
  | 'meals'
  | 'favorites'

export const TABLES: TableName[] = [
  'members',
  'member_private',
  'member_settings',
  'child_guardian_settings',
  'invites',
  'login_codes',
  'pairing_codes',
  'sessions',
  'push_subscriptions',
  'targets',
  'foods',
  'meals',
  'favorites',
]

export interface Store {
  all<T>(table: TableName): T[]
  get<T>(table: TableName, id: string): T | null
  put<T>(table: TableName, id: string, value: T): void
  del(table: TableName, id: string): void
}

export class MemoryStore implements Store {
  private data = new Map<TableName, Map<string, string>>()
  private t(table: TableName) {
    if (!this.data.has(table)) this.data.set(table, new Map())
    return this.data.get(table)!
  }
  all<T>(table: TableName): T[] {
    return [...this.t(table).values()].map((v) => JSON.parse(v) as T)
  }
  get<T>(table: TableName, id: string): T | null {
    const v = this.t(table).get(id)
    return v ? (JSON.parse(v) as T) : null
  }
  put<T>(table: TableName, id: string, value: T) {
    this.t(table).set(id, JSON.stringify(value))
  }
  del(table: TableName, id: string) {
    this.t(table).delete(id)
  }
}

/** Google Sheets-backed store. Call only while holding the script lock. */
export class SheetStore implements Store {
  private cache = new Map<TableName, { sheet: GoogleAppsScript.Spreadsheet.Sheet; rows: Map<string, { row: number; json: string }> }>()

  constructor(private ss: GoogleAppsScript.Spreadsheet.Spreadsheet) {}

  static ensureTabs(ss: GoogleAppsScript.Spreadsheet.Spreadsheet) {
    for (const name of TABLES) {
      let sheet = ss.getSheetByName(name)
      if (!sheet) sheet = ss.insertSheet(name)
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, 3).setValues([['id', 'json', 'updated_at']]).setFontWeight('bold')
        sheet.setFrozenRows(1)
      }
    }
  }

  private load(table: TableName) {
    let t = this.cache.get(table)
    if (t) return t
    // Tabs added in later versions are created on first use.
    let sheet = this.ss.getSheetByName(table)
    if (!sheet) {
      SheetStore.ensureTabs(this.ss)
      sheet = this.ss.getSheetByName(table)!
    }
    const rows = new Map<string, { row: number; json: string }>()
    const last = sheet.getLastRow()
    if (last > 1) {
      const values = sheet.getRange(2, 1, last - 1, 2).getValues()
      values.forEach(([id, json], i) => {
        if (id) rows.set(String(id), { row: i + 2, json: String(json) })
      })
    }
    t = { sheet, rows }
    this.cache.set(table, t)
    return t
  }

  all<T>(table: TableName): T[] {
    return [...this.load(table).rows.values()].map((r) => JSON.parse(r.json) as T)
  }

  get<T>(table: TableName, id: string): T | null {
    const r = this.load(table).rows.get(id)
    return r ? (JSON.parse(r.json) as T) : null
  }

  put<T>(table: TableName, id: string, value: T) {
    const t = this.load(table)
    const json = JSON.stringify(value)
    const existing = t.rows.get(id)
    const stamp = new Date().toISOString()
    if (existing) {
      t.sheet.getRange(existing.row, 2, 1, 2).setValues([[json, stamp]])
      existing.json = json
    } else {
      t.sheet.appendRow([id, json, stamp])
      t.rows.set(id, { row: t.sheet.getLastRow(), json })
    }
  }

  del(table: TableName, id: string) {
    const t = this.load(table)
    const existing = t.rows.get(id)
    if (!existing) return
    t.sheet.deleteRow(existing.row)
    t.rows.delete(id)
    // Rows below shifted up by one.
    for (const r of t.rows.values()) if (r.row > existing.row) r.row--
  }
}
