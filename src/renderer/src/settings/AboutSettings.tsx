import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/types'
import { RELEASES } from '../help/news'
import { Releases } from '../help/Releases'

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
      <h3>ℹ️ Acerca de Nuggit</h3>
      <p className="settings-hint">
        Versión {info?.version ?? '…'} · Make things easier to start, not harder to organize.
      </p>
      {info && (
        <div className="settings-field">
          <span>Tus datos se guardan solo en esta Mac:</span>
          <code className="settings-path">{info.dataPath}</code>
        </div>
      )}
      <div className="settings-subsection">
        <h4>🆕 Novedades</h4>
        {RELEASES[0] && <Releases releases={[RELEASES[0]]} />}
        <small className="settings-hint">Las de antes están en ❓ Ayuda → Novedades.</small>
      </div>
    </section>
  )
}
