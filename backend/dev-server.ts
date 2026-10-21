// Local stand-in for the Apps Script web app, running the real handlers on
// an in-memory store. Sign-in codes print to the console instead of email.
// Run: npm run dev:api   (then VITE_API_URL=http://localhost:8787 npm run dev)
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { handle } from './src/router'
import { MemoryStore } from './src/store'
import { generateVapidKeys } from './src/webpush'

const env = {
  store: new MemoryStore(),
  now: () => Date.now(),
  random: (n: number) => new Uint8Array(randomBytes(n)),
  sendMail: (to: string, subject: string) => console.log(`[mail to ${to}] ${subject}`),
  sendPush: () => 201,
  adminEmail: process.env.ADMIN_EMAIL ?? 'dev@example.com',
  vapid: generateVapidKeys(),
}

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') return res.end('Family Trainer dev API')
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const out = handle(env, JSON.parse(body || '{}'))
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(out))
  })
}).listen(8787, () => console.log(`Dev API on http://localhost:8787 (admin: ${env.adminEmail})`))
