import { createContext, useContext } from 'react'
import type { AppearanceSettings } from '../../../shared/types'

export const AppearanceContext = createContext<AppearanceSettings | null>(null)

// The general look (Ajustes → Apariencia), for widgets to fall back on.
export function useAppearance(): AppearanceSettings | null {
  return useContext(AppearanceContext)
}
