import { useSyncExternalStore } from 'react'
import tr from './tr.json'
import de from './de.json'
export type Language = 'en' | 'tr' | 'de'
export type Theme = 'light' | 'dark' | 'system'
const dictionaries: Record<string, Record<string, string>> = { tr, de }
let language: Language = typeof document !== 'undefined' && ['tr', 'de'].includes(document.documentElement.lang) ? document.documentElement.lang as Language : 'en'
let theme: Theme = typeof document !== 'undefined' && ['light', 'dark'].includes(document.documentElement.dataset.theme ?? '') ? document.documentElement.dataset.theme as Theme : 'system'
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useLanguage() { return useSyncExternalStore(subscribe, () => language, () => 'en' as Language) }
export function useTheme() { return useSyncExternalStore(subscribe, () => theme, () => 'system' as Theme) }
export function setLanguage(value: Language) {
  language = value; document.documentElement.lang = value
  try { localStorage.setItem('ds-language', value) } catch { /* Private mode: session preference still works. */ }
  listeners.forEach(listener => listener())
}
export function setTheme(value: Theme) {
  theme = value; document.documentElement.dataset.theme = value
  try { localStorage.setItem('ds-theme', value) } catch { /* Storage is optional. */ }
  listeners.forEach(listener => listener())
}
export function t(source: string, values: Record<string, string | number> = {}): string {
  return (dictionaries[language]?.[source] ?? source).replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
}
