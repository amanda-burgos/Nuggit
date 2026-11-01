import { useRef, useState } from 'react'
import type { SettingsPatch, SettingsTab } from '../../../shared/types'
import { DISCORD_INVITE, HELP, normalize } from '../../../shared/help'
import { RichText } from './RichText'

export type HelpSection = 'guides' | 'customize' | 'faq' | 'shortcuts' | 'news'

const SECTIONS: Array<{ key: HelpSection; label: string }> = [
  { key: 'guides', label: '📖 Cómo se usa' },
  { key: 'customize', label: '🎨 Dónde personalizar' },
  { key: 'faq', label: '❓ Preguntas' },
  { key: 'shortcuts', label: '⌨️ Atajos' },
  { key: 'news', label: '🆕 Novedades' }
]

interface Props {
  update(patch: SettingsPatch): void
  onStartTour(): void
  onOpenNews(): void // the 📣 Novedades panel
}

// Every word typed has to be somewhere in the entry.
const matches = (query: string, ...texts: string[]): boolean => {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const haystack = normalize(texts.join(' '))
  return words.every((w) => haystack.includes(w))
}

// Fase 10: the Ayuda tab. Its texts come from config/help.json.
export function HelpPanel({ update, onStartTour, onOpenNews }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const refs = useRef<Partial<Record<HelpSection, HTMLElement | null>>>({})

  const goTo = (key: HelpSection): void =>
    refs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const guides = HELP.guides.filter((g) => matches(query, g.title, g.text, ...g.keywords))
  const customize = HELP.customize.filter((c) => matches(query, c.title, c.text))
  const faq = HELP.faq.filter((f) => matches(query, f.q, f.a, ...f.keywords))
  const searching = query.trim() !== ''
  const nothing = searching && !guides.length && !customize.length && !faq.length

  const openSettings = (tab: string): void =>
    update({ ui: { tab: 'settings', settingsTab: tab as SettingsTab } })

  return (
    <div className="panel">
      <header className="panel-header help-header">
        <h1>
          <span aria-hidden>❓</span> Ayuda
        </h1>
        <button className="button-primary" onClick={onStartTour}>
          👋 Ver el tour otra vez
        </button>
      </header>
      <div className="panel-body help-body">
        <input
          type="search"
          className="help-search"
          placeholder="Busca: fondo, Lockdown, despegar, Ollama…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!searching && (
          <nav className="help-nav" aria-label="Secciones de Ayuda">
            {SECTIONS.map((s) => (
              <button key={s.key} className="help-chip" onClick={() => goTo(s.key)}>
                {s.label}
              </button>
            ))}
          </nav>
        )}

        {nothing && (
          <p className="help-empty">
            No encontré nada con eso. Prueba otra palabra, o pregúntale a Dip: también sabe cómo se
            usa Nuggit.
          </p>
        )}

        {guides.length > 0 && (
          <section ref={(el) => void (refs.current.guides = el)} className="help-section">
            <h2>📖 Cómo se usa</h2>
            <div className="help-cards">
              {guides.map((g) => (
                <article key={g.id} className="help-card">
                  <h3>
                    <span aria-hidden>{g.icon}</span> {g.title}
                  </h3>
                  <p>
                    <RichText text={g.text} />
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {customize.length > 0 && (
          <section ref={(el) => void (refs.current.customize = el)} className="help-section">
            <h2>🎨 Dónde personalizar</h2>
            <div className="help-list">
              {customize.map((c) => (
                <div key={c.id} className="help-row">
                  <span className="help-row-icon" aria-hidden>
                    {c.icon}
                  </span>
                  <div>
                    <strong>{c.title}</strong>
                    <p>{c.text}</p>
                  </div>
                  {c.settingsTab && (
                    <button className="button-ghost" onClick={() => openSettings(c.settingsTab!)}>
                      Abrir →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {faq.length > 0 && (
          <section ref={(el) => void (refs.current.faq = el)} className="help-section">
            <h2>❓ Preguntas frecuentes</h2>
            {faq.map((f) => (
              <details key={f.id} className="help-faq" open={searching}>
                <summary>{f.q}</summary>
                <p>
                  <RichText text={f.a} />
                </p>
              </details>
            ))}
          </section>
        )}

        {!searching && (
          <>
            <section ref={(el) => void (refs.current.shortcuts = el)} className="help-section">
              <h2>⌨️ Atajos de teclado</h2>
              <table className="help-shortcuts">
                <tbody>
                  {HELP.shortcuts.map((s) => (
                    <tr key={s.keys}>
                      <td>
                        <kbd>{s.keys}</kbd>
                      </td>
                      <td>{s.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section ref={(el) => void (refs.current.news = el)} className="help-section">
              <h2>🆕 Novedades</h2>
              <p className="help-empty">
                Todos los cambios de Nuggit, con su fecha, están en 📣 Novedades (abajo en la barra
                de la izquierda).
              </p>
              <div className="help-news-actions">
                <button className="button-ghost" onClick={onOpenNews}>
                  📣 Ver novedades
                </button>
                {DISCORD_INVITE && (
                  <a
                    className="button-primary"
                    href={DISCORD_INVITE}
                    target="_blank"
                    rel="noreferrer"
                  >
                    💬 Únete al Discord de Nuggit
                  </a>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
