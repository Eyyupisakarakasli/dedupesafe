import { describe, it, expect } from 'vitest'
import tr from '../src/i18n/tr.json'
import de from '../src/i18n/de.json'

describe('translation contracts', () => {
  it('provides both languages for every translated message', () => {
    expect(Object.keys(tr).sort()).toEqual(Object.keys(de).sort())
  })
  for (const [language, dictionary] of Object.entries({ tr, de })) {
    it(`${language} preserves dynamic values in every message`, () => {
      const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
      for (const [source, translated] of Object.entries(dictionary)) {
        expect(translated.trim(), source).not.toBe('')
        expect(placeholders(translated), source).toEqual(placeholders(source))
      }
    })
  }
})
