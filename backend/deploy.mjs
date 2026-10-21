// Publishes the pushed code as a new version of the same web-app deployment,
// so the /exec URL never changes. The first run creates the deployment.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const file = new URL('./deployment.json', import.meta.url)
const clasp = (...args) => execFileSync('npx', ['clasp', ...args], { encoding: 'utf8' })
const description = `deploy ${new Date().toISOString().slice(0, 16)}`

let id = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).deploymentId : null
if (id) {
  console.log(clasp('redeploy', id, '-d', description))
} else {
  const out = clasp('deploy', '-d', description)
  console.log(out)
  id = out.match(/AKfy[\w-]+/)?.[0]
  if (!id) throw new Error('Could not find the deployment id in clasp output')
  writeFileSync(file, JSON.stringify({ deploymentId: id }, null, 2) + '\n')
}
console.log(`Web app URL: https://script.google.com/macros/s/${id}/exec`)
