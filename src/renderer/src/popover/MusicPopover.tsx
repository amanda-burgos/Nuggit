import { useEffect } from 'react'
import { useSettings } from '../store/useSettings'
import { MusicWidget } from '../widgets/music/MusicWidget'
import './popover.css'
import { t } from '../../../shared/i18n'

const close = (): void => window.api.popover.hide()

// SPEC 9.19: the mini player that opens from the music menu bar icon. Same controls as
// the Música widget. Closes with its X, with Esc, or by clicking outside.
export function MusicPopover(): React.JSX.Element {
  useSettings() // follows the app's theme

  useEffect(() => {
    document.title = t('Música', 'Music')
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="popover">
      <header className="popover-header">
        <span className="popover-title">{t('🎵 Música', '🎵 Music')}</span>
        <button className="icon-button" title={t('Cerrar (Esc)', 'Close (Esc)')} onClick={close}>
          ×
        </button>
      </header>
      <div className="popover-body">
        <MusicWidget
          instanceId="music-popover"
          size="popover"
          config={{}}
          updateConfig={() => undefined}
        />
      </div>
    </div>
  )
}
