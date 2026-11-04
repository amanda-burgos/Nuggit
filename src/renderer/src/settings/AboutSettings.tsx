import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/types'
import { releases } from '../help/news'
import { Releases } from '../help/Releases'
import { t } from '../../../shared/i18n'

export function AboutSettings(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    window.api.app
      .info()
      .then(setInfo)
      .catch((err) => console.error('Could not load app info', err))
  }, [])

  return (
    <section className="settings-section">
      <h3>ℹ️ {t('Acerca de Nuggit', 'About Nuggit')}</h3>
      <p className="settings-hint">
        {t('Versión', 'Version')} {info?.version ?? '…'} · Make things easier to start, not harder
        to organize.
      </p>
      {info && (
        <div className="settings-field">
          <span>
            {t('Tus datos se guardan solo en esta Mac:', 'Your data is saved only on this Mac:')}
          </span>
          <code className="settings-path">{info.dataPath}</code>
        </div>
      )}
      <div className="settings-subsection">
        <h4>🆕 {t('Novedades', "What's new")}</h4>
        {releases()[0] && <Releases releases={[releases()[0]]} />}
        <small className="settings-hint">
          {t(
            'Las de antes están en ❓ Ayuda → Novedades.',
            "Older ones are in ❓ Help → What's new."
          )}
        </small>
      </div>
    </section>
  )
}
