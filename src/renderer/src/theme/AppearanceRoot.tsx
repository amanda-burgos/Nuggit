import { useEffect, useState } from 'react'
import type { AppearanceSettings, ThemePreference } from '../../../shared/types'
import { getLang, setLang, type Lang } from '../../../shared/i18n'
import { applyAppearance } from './appearance'
import { AppearanceContext } from './appearanceContext'
import { applyMouseCursor, cursorBackground } from './mouseCursor'
import { MouseTrailLayer } from './MouseTrailLayer'

// Wraps every window: loads Apariencia and the language, keeps them applied, and shares
// Apariencia. Fase 14: the window waits for the language before drawing, and draws itself
// again from scratch when it changes (every text is written with t()).
export function AppearanceRoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(null)
  const [lang, setLangState] = useState<Lang | null>(null)

  useEffect(() => {
    let theme: ThemePreference | undefined
    let latest: AppearanceSettings | null = null
    // Fase 16: the dressed-up mouse; its outline depends on the window's background.
    const applyMouse = (): void => {
      if (latest) {
        applyMouseCursor(latest.mouse, cursorBackground(latest.themeColor, theme))
      }
    }
    const apply = (next: {
      appearance: AppearanceSettings
      language?: Lang
      theme?: ThemePreference
    }): void => {
      applyAppearance(next.appearance)
      theme = next.theme
      latest = next.appearance
      applyMouse()
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
    const dark = matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener('change', applyMouse)
    const unsubscribe = window.api.settings.onChange(apply)
    return () => {
      unsubscribe()
      dark.removeEventListener('change', applyMouse)
    }
  }, [])

  const mouse = appearance?.mouse
  const trailOn = !!mouse?.trail.on && mouse.trail.styles.length > 0

  if (!lang) return <></>
  return (
    <AppearanceContext.Provider value={appearance}>
      <LangKey key={lang}>{children}</LangKey>
      {trailOn && <MouseTrailLayer mouse={mouse} />}
    </AppearanceContext.Provider>
  )
}

const LangKey = ({ children }: { children: React.ReactNode }): React.JSX.Element => <>{children}</>
