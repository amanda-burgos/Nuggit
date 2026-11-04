import { describe, expect, it } from 'vitest'
import { newestDate, parseChangelog, releaseFor, unseenCount } from './changelog'
import { helpForDip, searchHelp } from './help'
import { setLang } from './i18n'

describe('searchHelp', () => {
  it('finds the entry a question is about, accents or not', () => {
    expect(searchHelp('¿Cómo uso el temporizador de focus?')[0].title).toMatch(/Focus/)
    expect(searchHelp('como regreso un widget al tablero')[0].title).toMatch(/regreso/)
  })

  it('finds nothing for words that are not about the app', () => {
    expect(searchHelp('hola')).toEqual([])
  })
})

describe('helpForDip', () => {
  it('adds help to "how do I" questions', () => {
    expect(helpForDip('¿Cómo conecto Ollama?')).toContain('Ollama')
  })

  it('stays empty for normal chat', () => {
    expect(helpForDip('anota tarea de inglés para mañana')).toBe('')
    expect(helpForDip('estoy cansada hoy')).toBe('')
  })
})

describe('help in English', () => {
  it('searches the English texts and answers how-to questions', () => {
    setLang('en')
    try {
      expect(searchHelp('How do I use the focus timer?')[0].title).toMatch(/Focus/)
      expect(helpForDip('How do I connect Ollama?')).toContain('Nuggit help')
      expect(helpForDip("I'm tired today")).toBe('')
    } finally {
      setLang('es')
    }
  })
})

describe('parseChangelog', () => {
  const md = `# Novedades

## [Sin publicar]

### Nuevo
- **Ayuda:** una pestaña nueva.

## [1.0.0] - 2026-11-02

### Arreglado
- Algo.
`

  it('reads versions, dates and groups', () => {
    const releases = parseChangelog(md)
    expect(releases.map((r) => r.version)).toEqual(['Sin publicar', '1.0.0'])
    expect(releases[1].date).toBe('2026-11-02')
    expect(releases[0].groups[0]).toEqual({
      title: 'Nuevo',
      items: ['**Ayuda:** una pestaña nueva.']
    })
  })

  it('picks this version, or the newest one', () => {
    const releases = parseChangelog(md)
    expect(releaseFor(releases, '1.0.0')?.version).toBe('1.0.0')
    expect(releaseFor(releases, '2.0.0')?.version).toBe('Sin publicar')
  })

  it('counts the entries newer than the last one seen', () => {
    const releases = parseChangelog(`## [Hoy] - 2026-10-30
- Algo nuevo.

## [Antes] - 2026-10-20
- Algo viejo.
`)
    expect(newestDate(releases)).toBe('2026-10-30')
    expect(unseenCount(releases)).toBe(2)
    expect(unseenCount(releases, '2026-10-20')).toBe(1)
    expect(unseenCount(releases, '2026-10-30')).toBe(0)
  })
})
