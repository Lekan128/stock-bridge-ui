// Runs the end-to-end suites in order (Phase H). Each suite is a plain Node script that drives a
// real browser against a running API and the production preview build — see e2e/README.md.
//
//   npm run e2e                 every suite
//   npm run e2e -- outbox quick just these
//   E2E_SCALE=1 npm run e2e -- catalog   include the 100,000-product scale run
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Dependency order, roughly: the shell and data layer first, the screens built on them after. */
const SUITES = [
  'urgent-fixes',
  'pwa-shell',
  'landing',
  'first-week',
  'seo-pages',
  'lost-refresh',
  'data-layer',
  'catalog',
  'outbox',
  'drafts',
  'sync-centre',
  'foundation',
  'inventory',
  'product',
  'sheets',
  'quick',
  'dashboard',
  'chaos',
  'metrics',
  'a11y',
]

const wanted = process.argv.slice(2)
const unknown = wanted.filter((name) => !SUITES.includes(name))
if (unknown.length > 0) {
  console.error(`Unknown suite: ${unknown.join(', ')}. Known: ${SUITES.join(', ')}`)
  process.exit(2)
}
const run = wanted.length > 0 ? SUITES.filter((name) => wanted.includes(name)) : SUITES

function runSuite(name) {
  return new Promise((resolve) => {
    const file = fileURLToPath(new URL(`./suites/${name}.e2e.mjs`, import.meta.url))
    // The catalogue's 100k run takes minutes; it is opt-in.
    const env = { ...process.env, ONLY: name === 'catalog' && !process.env.E2E_SCALE ? 'small' : process.env.ONLY }
    const child = spawn(process.execPath, [file], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let tally = ''
    // Chunks split anywhere, so hold each stream's unfinished last line until the rest arrives.
    const relay = () => {
      let pending = ''
      const print = (line) => {
        process.stdout.write(`  ${name.padEnd(13)}│ ${line}\n`)
        const match = line.match(/(\d+)\/(\d+) passed/)
        if (match) tally = match[0]
      }
      return {
        data(chunk) {
          const lines = (pending + chunk.toString()).split('\n')
          pending = lines.pop()
          lines.forEach(print)
        },
        end() {
          if (pending) print(pending)
        },
      }
    }
    const out = relay()
    const err = relay()
    child.stdout.on('data', out.data)
    child.stderr.on('data', err.data)
    child.on('close', (code) => {
      out.end()
      err.end()
      resolve({ name, ok: code === 0, tally })
    })
  })
}

const results = []
for (const name of run) {
  console.log(`\n▶ ${name}`)
  results.push(await runSuite(name))
}
console.log('\nSummary')
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(13)} ${r.tally}`)
const failed = results.filter((r) => !r.ok)
console.log(failed.length ? `\n${failed.length} suite(s) failed.` : '\nAll suites passed.')
process.exit(failed.length ? 1 : 0)
