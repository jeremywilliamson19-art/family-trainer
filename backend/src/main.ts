// Apps Script entry points. The build (backend/build.mjs) exposes doGet,
// doPost and setup as top-level functions.
import './polyfill'
import { randomBytes } from '@noble/hashes/utils.js'
import { handle, type Env } from './api'
import { SheetStore } from './store'
import { generateVapidKeys } from './webpush'

const props = () => PropertiesService.getScriptProperties()

/** The data spreadsheet; setup() creates it and remembers its id. */
function dataSheet() {
  const id = props().getProperty('SHEET_ID')
  if (!id) throw new Error('Run setup() first')
  return SpreadsheetApp.openById(id)
}

/** Run once from the Apps Script editor: creates the data sheet and push keys. */
export function setup() {
  const p = props()
  if (!p.getProperty('SHEET_ID')) {
    p.setProperty('SHEET_ID', SpreadsheetApp.create('Family Trainer Data').getId())
  }
  const ss = dataSheet()
  SheetStore.ensureTabs(ss)
  const blank = ss.getSheetByName('Sheet1')
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank)

  if (!p.getProperty('ADMIN_EMAIL')) p.setProperty('ADMIN_EMAIL', Session.getEffectiveUser().getEmail().toLowerCase())
  if (!p.getProperty('VAPID_PRIVATE_KEY')) {
    // The private key never leaves Script Properties.
    const k = generateVapidKeys()
    p.setProperties({ VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey })
  }
  console.log(`Ready. Admin: ${p.getProperty('ADMIN_EMAIL')}. Data: ${ss.getUrl()}. Email quota left today: ${MailApp.getRemainingDailyQuota()}`)
}

function env(): Env {
  const p = props().getProperties()
  if (!p.VAPID_PRIVATE_KEY) throw new Error('Run setup() first')
  return {
    store: new SheetStore(dataSheet()),
    now: () => Date.now(),
    random: (n) => randomBytes(n),
    sendMail: (to, subject, html) => MailApp.sendEmail({ to, subject, htmlBody: html, name: 'Family Trainer' }),
    sendPush: (req) => {
      const signed = Array.from(req.body, (b) => (b > 127 ? b - 256 : b))
      return UrlFetchApp.fetch(req.url, {
        method: 'post',
        headers: req.headers,
        payload: Utilities.newBlob(signed, 'application/octet-stream'),
        muteHttpExceptions: true,
      }).getResponseCode()
    },
    adminEmail: p.ADMIN_EMAIL,
    vapid: { publicKey: p.VAPID_PUBLIC_KEY, privateKey: p.VAPID_PRIVATE_KEY },
  }
}

function json(obj: unknown) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

export function doGet() {
  return json({ ok: true, data: 'Family Trainer API' })
}

export function doPost(e: GoogleAppsScript.Events.DoPost) {
  let body: Record<string, unknown>
  try {
    body = JSON.parse(e.postData.contents)
  } catch {
    return json({ ok: false, error: 'Bad request', code: 'invalid' })
  }
  // One request at a time keeps the sheet consistent; plenty for 3 people.
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(25000)) return json({ ok: false, error: 'Busy. Try again.', code: 'busy' })
  try {
    return json(handle(env(), body))
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Something went wrong. Try again.', code: 'server' })
  } finally {
    lock.releaseLock()
  }
}
