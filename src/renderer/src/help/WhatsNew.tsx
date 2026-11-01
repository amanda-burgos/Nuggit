import { useEffect } from 'react'
import type { ChangelogRelease } from '../../../shared/changelog'
import { DISCORD_INVITE } from '../../../shared/help'
import { Releases } from './Releases'

interface Props {
  release: ChangelogRelease
  version: string // the app's version
  onSeeAll(): void
  onClose(): void
}

// Fase 10: after an update, what's new in this version (can be turned off in Ajustes).
export function WhatsNew({ release, version, onSeeAll, onClose }: Props): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="help-overlay" onClick={onClose}>
      <div
        className="whats-new"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="whats-new-title">✨ Qué hay de nuevo en la versión {version}</h2>
        <div className="whats-new-body">
          <Releases releases={[release]} />
        </div>
        <footer className="whats-new-actions">
          {DISCORD_INVITE && (
            <a className="button-ghost" href={DISCORD_INVITE} target="_blank" rel="noreferrer">
              💬 Discord
            </a>
          )}
          <button className="button-ghost" onClick={onSeeAll}>
            Ver todo
          </button>
          <button className="button-primary" onClick={onClose} autoFocus>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}
