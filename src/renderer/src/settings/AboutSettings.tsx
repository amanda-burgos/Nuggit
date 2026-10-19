import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/types'
import changelog from '../../../../CHANGELOG.md?raw'

// The newest part of CHANGELOG.md (the first version block), as simple blocks.
function latestNews(): Array<{ kind: 'heading' | 'item'; text: string }> {
  const blocks = changelog.split(/^## /m).slice(1)
  if (!blocks.length) return []
  const [title, ...lines] = blocks[0].split('\n')
  const items: Array<{ kind: 'heading' | 'item'; text: string }> = [
    { kind: 'heading', text: title.replace(/[[\]]/g, '').trim() }
  ]
  for (const line of lines) {
    if (line.startsWith('### ')) items.push({ kind: 'heading', text: line.slice(4) })
    else if (line.startsWith('- ')) items.push({ kind: 'item', text: line.slice(2) })
  }
  return items
}

// "**Notas rápidas:** ..." → bold part and the rest.
function Item({ text }: { text: string }): React.JSX.Element {
  const match = /^\*\*(.+?)\*\*(.*)$/.exec(text)
  const clean = (s: string): string => s.replace(/\*\*|`/g, '')
  return match ? (
    <p className="settings-news-item">
      <strong>{clean(match[1])}</strong>
      {clean(match[2])}
    </p>
  ) : (
    <p className="settings-news-item">{clean(text)}</p>
  )
}

export function AboutSettings(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    window.api.app
      .info()
      .then(setInfo)
      .catch((err) => console.error('Could not load app info', err))
  }, [])

  const news = latestNews()
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
        <div className="settings-news">
          {news.map((n, i) =>
            n.kind === 'heading' ? <h5 key={i}>{n.text}</h5> : <Item key={i} text={n.text} />
          )}
        </div>
      </div>
    </section>
  )
}
