import { useEffect, useState } from 'react'
import type { AppearanceSettings } from '../../../shared/types'
import { applyAppearance } from './appearance'
import { AppearanceContext } from './appearanceContext'

// Wraps every window: loads Apariencia, keeps it applied, and shares it.
export function AppearanceRoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(null)

  useEffect(() => {
    const apply = (next: AppearanceSettings): void => {
      applyAppearance(next)
      setAppearance(next)
    }
    window.api.settings
      .load()
      .then((s) => apply(s.appearance))
      .catch((err) => console.error('Could not load appearance', err))
    return window.api.settings.onChange((s) => apply(s.appearance))
  }, [])

  return <AppearanceContext.Provider value={appearance}>{children}</AppearanceContext.Provider>
}
