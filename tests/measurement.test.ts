import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8')

const ANALYTICS = '/_vercel/insights/script.js'

describe('page counting stays off the checker', () => {
  it('loads the analytics script on every marketing page', () => {
    expect(read('index.html')).toContain(ANALYTICS)
    expect(read('public/privacy/index.html')).toContain(ANALYTICS)
    expect(read('public/limitations/index.html')).toContain(ANALYTICS)
  })

  it('never loads it on the checker', () => {
    expect(read('app/index.html')).not.toContain(ANALYTICS)
  })
})

describe('content security policy', () => {
  const config = JSON.parse(read('vercel.json')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[]
  }
  const cspFor = (source: string) => {
    const rule = config.headers.find(h => h.source === source)
    if (!rule) throw new Error(`no header rule for ${source}`)
    const csp = rule.headers.find(h => h.key === 'Content-Security-Policy')
    if (!csp) throw new Error(`no policy for ${source}`)
    return csp.value
  }

  it('keeps the checker unable to open any connection', () => {
    expect(cspFor('/app/:path*')).toContain("connect-src 'none'")
  })

  it('lets the marketing pages report a page view to their own origin', () => {
    expect(cspFor('/')).toContain("connect-src 'self'")
    expect(cspFor('/:path((?!app/).*)')).toContain("connect-src 'self'")
  })

  it('keeps every other protection on both policies', () => {
    for (const rule of config.headers) {
      const keys = rule.headers.map(h => h.key)
      expect(keys).toContain('X-Content-Type-Options')
      expect(keys).toContain('Strict-Transport-Security')
      const csp = rule.headers.find(h => h.key === 'Content-Security-Policy')!.value
      expect(csp).toContain("frame-ancestors 'none'")
      expect(csp).toContain("object-src 'none'")
    }
  })
})
