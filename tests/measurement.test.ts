import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CHECKER_CSP, withCheckerCsp } from '../scripts/checker-csp'

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

  it('sends one header rule that covers every path', () => {
    // A split by path was tried and reverted: a source pattern that missed
    // "/app/" served the checker with no security headers at all.
    expect(config.headers).toHaveLength(1)
    expect(config.headers[0].source).toBe('/(.*)')
  })

  it('lets any page report a page view to its own origin', () => {
    const header = config.headers[0].headers.find(h => h.key === 'Content-Security-Policy')
    expect(header?.value).toContain("connect-src 'self'")
    expect(header?.value).toContain("frame-ancestors 'none'")
  })

  it('gives the checker a stricter policy of its own', () => {
    expect(CHECKER_CSP).toContain("connect-src 'none'")
    const built = withCheckerCsp('<html><head></head><body></body></html>', '/build/app/index.html')
    expect(built).toContain("connect-src 'none'")
  })

  it('adds that policy to no other page, and never twice', () => {
    const landing = withCheckerCsp('<html><head></head></html>', '/build/index.html')
    expect(landing).not.toContain('Content-Security-Policy')
    const checker = withCheckerCsp('<html><head></head></html>', '/build/app/index.html')
    expect(withCheckerCsp(checker, '/build/app/index.html')).toBe(checker)
  })
})
