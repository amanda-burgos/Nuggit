// Fase 14: the app's language (Spanish or English), chosen the first time Nuggit opens and
// in Ajustes → General. Texts are written in place as pairs: t('Guardar', 'Save').
// Every window (and the main process) keeps the current language here; changing it in
// Ajustes redraws every window.

export type Lang = 'es' | 'en'
export const LANGS: Lang[] = ['es', 'en']

let current: Lang = 'es'
const listeners = new Set<(lang: Lang) => void>()

export const isLang = (value: unknown): value is Lang => value === 'es' || value === 'en'

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang | undefined): void {
  const next = lang ?? 'es'
  if (next === current) return
  current = next
  for (const listener of listeners) listener(next)
}

export function onLangChange(listener: (lang: Lang) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The text in the current language.
export function t(es: string, en: string): string {
  return current === 'en' ? en : es
}

// For dates and times: toLocaleDateString(locale(), …).
export function locale(): string {
  return current === 'en' ? 'en-US' : 'es'
}
