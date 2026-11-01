import { useEffect } from 'react'
import { DISCORD_INVITE } from '../../../shared/help'
import { RELEASES } from './news'
import { Releases } from './Releases'

// 📣 Novedades: every change to Nuggit, newest first, with its date (from CHANGELOG.md).
export function NewsPanel({ onClose }: { onClose(): void }): React.JSX.Element {
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
        className="whats-new news-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="news-title">📣 Novedades</h2>
        <p className="news-panel-intro">Todo lo que ha cambiado en Nuggit, lo más nuevo arriba.</p>
        <div className="whats-new-body">
          <Releases releases={RELEASES} />
        </div>
        <footer className="whats-new-actions">
          {DISCORD_INVITE && (
            <a className="button-ghost" href={DISCORD_INVITE} target="_blank" rel="noreferrer">
              💬 Discord
            </a>
          )}
          <button className="button-primary" onClick={onClose} autoFocus>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}
