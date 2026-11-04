import { useEffect, useState } from 'react'
import type { AppearanceSettings } from '../../../shared/types'
import { getLang, setLang, type Lang } from '../../../shared/i18n'
import { applyAppearance } from './appearance'
import { AppearanceContext } from './appearanceContext'

// Wraps every window: loads Apariencia and the language, keeps them applied, and shares
// Apariencia. Fase 14: the window waits for the language before drawing, and draws itself
// again from scratch when it changes (every text is written with t()).
export function AppearanceRoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(null)
  const [lang, setLangState] = useState<Lang | null>(null)

  useEffect(() => {
    const apply = (next: { appearance: AppearanceSettings; language?: Lang }): void => {
      applyAppearance(next.appearance)
      setAppearance(next.appearance)
      setLang(next.language)
      document.documentElement.lang = getLang()
      setLangState(getLang())
    }
    window.api.settings
      .load()
      .then(apply)
      .catch((err) => {
        console.error('Could not load appearance', err)
        setLangState(getLang())
      })
    return window.api.settings.onChange(apply)
  }, [])

  if (!lang) return <></>
  return (
    <AppearanceContext.Provider value={appearance}>
      <LangKey key={lang}>{children}</LangKey>
    </AppearanceContext.Provider>
  )
}

const LangKey = ({ children }: { children: React.ReactNode }): React.JSX.Element => <>{children}</>
