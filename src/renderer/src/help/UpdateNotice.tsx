import { useEffect, useState } from 'react'
import { t } from '../../../shared/i18n'
import type { UpdateInfo } from '../../../shared/updates'

// Fase 15: a newer Nuggit is on GitHub. "Descargar" opens its Release page in the browser;
// "Ahora no" hides it until Nuggit opens again.
export function UpdateNotice(): React.JSX.Element | null {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    window.api.updates
      .pending()
      .then(setUpdate)
      .catch((err) => console.error('Could not check for updates', err))
    return window.api.updates.onAvailable(setUpdate)
  }, [])

  if (!update) return null
  const report = (err: unknown): void => console.error('Update notice', err)
  const later = (): void => {
    setUpdate(null)
    window.api.updates.dismiss().catch(report)
  }
  const download = (): void => {
    window.api.updates.open().catch(report)
    later()
  }

  return (
    <div className="update-notice" role="status" aria-live="polite">
      <span className="update-notice-icon" aria-hidden>
        🎁
      </span>
      <div className="update-notice-text">
        <strong>
          {t('¡Hay una versión nueva de Nuggit!', "There's a new version of Nuggit!")}
        </strong>
        <span>
          {t(
            `La ${update.version} ya está lista. Bájala y reemplaza la app; tus cosas no se pierden.`,
            `${update.version} is ready. Download it and replace the app; your stuff stays.`
          )}
        </span>
      </div>
      <div className="update-notice-actions">
        <button className="button-ghost" onClick={later}>
          {t('Ahora no', 'Not now')}
        </button>
        <button className="button-primary" onClick={download}>
          {t('Descargar', 'Download')}
        </button>
      </div>
    </div>
  )
}
