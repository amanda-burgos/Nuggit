import { useEffect, useRef } from 'react'
import type { Settings, SettingsPatch } from '../../../shared/types'
import { AISettings } from './AISettings'
import { DipPersonality } from './DipPersonality'
import './settings.css'

interface Props {
  settings: Settings | null
  update(patch: SettingsPatch): void
  onClose(): void
}

export function SettingsPanel({ settings, update, onClose }: Props): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="settings-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="settings-header">
          <h2 id="settings-title">Ajustes</h2>
          <button className="icon-button" title="Cerrar (Esc)" onClick={onClose}>
            ×
          </button>
        </header>
        {settings && (
          <div className="settings-body">
            <AISettings settings={settings} update={update} />
            <DipPersonality settings={settings} update={update} />
          </div>
        )}
      </div>
    </div>
  )
}
