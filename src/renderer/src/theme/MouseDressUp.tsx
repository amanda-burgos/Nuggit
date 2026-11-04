import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  MouseFavorite,
  MouseShape,
  MouseStyle,
  Settings,
  SettingsPatch,
  TrailColorMode,
  TrailLayer,
  TrailStyle
} from '../../../shared/types'
import {
  MOUSE_FAVORITES_MAX,
  MOUSE_NAME_MAX,
  TRAIL_LENGTH_MAX,
  TRAIL_LENGTH_MIN,
  TRAIL_MAX_COLORS,
  TRAIL_MAX_STYLES,
  TRAIL_STYLES
} from '../../../shared/types'
import {
  QUICK_COLORS,
  cleanMouseName,
  defaultMouse,
  exampleFavorites,
  hasDetails,
  randomMouse
} from '../../../shared/mouse'
import { t } from '../../../shared/i18n'
import { ACCENT_PRESETS } from './appearance'
import { cursorBackground, cursorCss, cursorSvg, svgDataUrl } from './mouseCursor'
import { ALL_SHAPES, modeName, shapeName, sizeName, trailName } from './mouseNames'
import { TrailEngine, useReducedMotion } from './mouseTrail'
import './mouse-dressup.css'

type Tab = 'cursor' | 'colors' | 'trail' | 'favorites'
type Part = 'fill' | 'fill2' | 'border' | 'details' | 'trail0' | 'trail1'

const tabs = (): Array<{ id: Tab; label: string }> => [
  { id: 'cursor', label: t('🖱️ Cursor', '🖱️ Cursor') },
  { id: 'colors', label: t('🎨 Colores', '🎨 Colors') },
  { id: 'trail', label: t('✨ Estela', '✨ Trail') },
  { id: 'favorites', label: t('⭐ Favoritos', '⭐ Favorites') }
]

const newId = (): string =>
  `fav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

// A little picture of a shape in some colors (for the buttons and the lists).
export function MouseIcon({
  mouse,
  size = 32
}: {
  mouse: MouseStyle
  size?: number
}): React.JSX.Element {
  if (mouse.shape === 'system') {
    return (
      <span className="mouse-icon is-system" style={{ fontSize: size * 0.7 }} aria-hidden="true">
        🖱️
      </span>
    )
  }
  const svg = cursorSvg({ ...mouse, size: 'medium' }, 'default', '#ffffff')
  return <img className="mouse-icon" src={svgDataUrl(svg)} width={size} height={size} alt="" />
}

// Fase 16: 🖱️ Vestidor del mouse. Choose on the left, try it on the right; nothing changes
// in the app until "Guardar".
export function MouseDressUp({
  settings,
  update,
  onClose
}: {
  settings: Settings
  update(patch: SettingsPatch): void
  onClose(): void
}): React.JSX.Element {
  const [draft, setDraft] = useState<MouseStyle>(() => structuredClone(settings.appearance.mouse))
  const [tab, setTab] = useState<Tab>('cursor')
  const [part, setPart] = useState<Part>('fill')
  const [chip, setChip] = useState(0)
  const [chosenFavorite, setChosenFavorite] = useState<string | null>(null)
  const { appearance } = settings
  const accent = ACCENT_PRESETS[appearance.accent]?.light ?? appearance.accent
  const background = cursorBackground(appearance.themeColor, settings.theme)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const change = (next: MouseStyle): void => {
    setDraft(next)
    setChosenFavorite(null)
  }
  const load = (style: MouseStyle, id: string | null): void => {
    setDraft(structuredClone(style))
    setChosenFavorite(id)
    setPart('fill')
    setChip(0)
  }

  const save = (): void => {
    update({ appearance: { mouse: draft } })
    onClose()
  }

  return (
    <div className="mouse-dressup-overlay">
      <div
        className="mouse-dressup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mouse-dressup-title"
      >
        <header className="mouse-dressup-header">
          <h2 id="mouse-dressup-title">🖱️ {t('Vestidor del mouse', 'Mouse dress-up')}</h2>
          <div className="mouse-dressup-header-actions">
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                change(randomMouse())
                setPart('fill')
                setChip(0)
              }}
            >
              🎲 {t('Sorpréndeme', 'Surprise me')}
            </button>
            <button type="button" className="button-ghost" onClick={() => change(defaultMouse())}>
              ↩︎ {t('Mouse normal', 'Normal mouse')}
            </button>
          </div>
        </header>

        <div className="mouse-dressup-body">
          <div className="mouse-dressup-options">
            <div className="mouse-tabs" role="tablist">
              {tabs().map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === tb.id}
                  className={`mouse-tab${tab === tb.id ? ' is-active' : ''}`}
                  onClick={() => setTab(tb.id)}
                >
                  {tb.label}
                </button>
              ))}
            </div>
            <div className="mouse-tab-panel" role="tabpanel">
              {tab === 'cursor' && <CursorTab draft={draft} change={change} />}
              {tab === 'colors' && (
                <ColorsTab
                  draft={draft}
                  change={change}
                  accent={accent}
                  part={part}
                  setPart={setPart}
                  chip={chip}
                  setChip={setChip}
                />
              )}
              {tab === 'trail' && (
                <TrailTab
                  draft={draft}
                  change={change}
                  editColors={(i) => {
                    setPart(i ? 'trail1' : 'trail0')
                    setChip(0)
                    setTab('colors')
                  }}
                />
              )}
              {tab === 'favorites' && (
                <FavoritesTab
                  draft={draft}
                  favorites={settings.mouseFavorites}
                  chosen={chosenFavorite}
                  load={load}
                  saveFavorites={(mouseFavorites) => update({ mouseFavorites })}
                />
              )}
            </div>
          </div>

          <Preview draft={draft} background={background} />
        </div>

        <footer className="mouse-dressup-footer">
          <small>
            {t(
              'Solo se ve dentro de las ventanas de Nuggit; fuera de Nuggit tu computadora usa su cursor de siempre.',
              "It only shows inside Nuggit's windows; outside Nuggit your computer uses its usual cursor."
            )}
          </small>
          <div className="mouse-dressup-footer-actions">
            <button type="button" className="button-ghost" onClick={onClose}>
              {t('Cancelar', 'Cancel')}
            </button>
            <button type="button" className="button-primary" onClick={save}>
              {t('Guardar', 'Save')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

interface EditProps {
  draft: MouseStyle
  change(next: MouseStyle): void
}

function CursorTab({ draft, change }: EditProps): React.JSX.Element {
  const pick = (shape: MouseShape): void => change({ ...draft, shape })
  return (
    <>
      <div className="mouse-shape-grid" role="radiogroup" aria-label={t('Forma', 'Shape')}>
        {ALL_SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={draft.shape === shape}
            className={`mouse-shape${draft.shape === shape ? ' is-active' : ''}`}
            onClick={() => pick(shape)}
          >
            <MouseIcon mouse={{ ...draft, shape }} size={36} />
            <span>{shapeName(shape)}</span>
          </button>
        ))}
      </div>
      <fieldset className="mouse-segmented" disabled={draft.shape === 'system'}>
        <legend>{t('Tamaño', 'Size')}</legend>
        {(['small', 'medium', 'large'] as const).map((size) => (
          <label key={size} className={draft.size === size ? 'is-active' : ''}>
            <input
              type="radio"
              name="mouse-size"
              checked={draft.size === size}
              onChange={() => change({ ...draft, size })}
            />
            {sizeName(size)}
          </label>
        ))}
      </fieldset>
      <small className="mouse-hint">
        {t(
          'El de escribir (I) y el de "puedes hacer clic" (con un puntito) se visten igual.',
          'The typing one (I) and the "you can click" one (with a little dot) get dressed the same.'
        )}
      </small>
    </>
  )
}

// The quick colors (and the accent) plus the color wheel.
function ColorChoices({
  value,
  accent,
  onPick
}: {
  value: string
  accent: string
  onPick(hex: string): void
}): React.JSX.Element {
  const quick = [
    ...QUICK_COLORS.map((c) => ({ hex: c.hex, name: c.name() })),
    { hex: accent.toLowerCase(), name: t('Color de acento', 'Accent color') }
  ]
  return (
    <div className="mouse-colors">
      {quick.map((c) => (
        <button
          key={c.name}
          type="button"
          className={`mouse-swatch${value === c.hex ? ' is-active' : ''}`}
          style={{ background: c.hex }}
          title={c.name}
          aria-label={c.name}
          aria-pressed={value === c.hex}
          onClick={() => onPick(c.hex)}
        />
      ))}
      <label className="mouse-swatch is-wheel" title={t('Cualquier color', 'Any color')}>
        <input
          type="color"
          aria-label={t('Cualquier color', 'Any color')}
          value={value}
          onChange={(e) => onPick(e.target.value.toLowerCase())}
        />
      </label>
    </div>
  )
}

function ColorsTab({
  draft,
  change,
  accent,
  part,
  setPart,
  chip,
  setChip
}: EditProps & {
  accent: string
  part: Part
  setPart(p: Part): void
  chip: number
  setChip(i: number): void
}): React.JSX.Element {
  const custom = draft.shape !== 'system'
  const layers = draft.trail.on ? draft.trail.styles : []
  const parts: Array<{ id: Part; label: string }> = []
  if (custom) {
    parts.push({ id: 'fill', label: t('Relleno', 'Fill') })
    if (draft.colors.fill2) parts.push({ id: 'fill2', label: t('Relleno 2', 'Fill 2') })
    parts.push({ id: 'border', label: t('Borde', 'Border') })
    if (hasDetails(draft.shape)) parts.push({ id: 'details', label: t('Detalles', 'Details') })
  }
  layers.forEach((layer, i) =>
    parts.push({
      id: i ? 'trail1' : 'trail0',
      label: `${t('Estela', 'Trail')}: ${trailName(layer.style)}`
    })
  )
  const current = parts.find((p) => p.id === part)?.id ?? parts[0]?.id

  if (!current) {
    return (
      <p className="mouse-empty">
        {t(
          'Escoge una forma en 🖱️ Cursor o prende la ✨ Estela para darle color.',
          'Pick a shape in 🖱️ Cursor or turn on the ✨ Trail to give it color.'
        )}
      </p>
    )
  }

  const setColor = (key: 'fill' | 'fill2' | 'border' | 'details', hex: string): void =>
    change({ ...draft, colors: { ...draft.colors, [key]: hex } })
  const layerIndex = current === 'trail1' ? 1 : 0
  const layer = current.startsWith('trail') ? layers[layerIndex] : null
  const setLayer = (next: TrailLayer): void =>
    change({
      ...draft,
      trail: {
        ...draft.trail,
        styles: draft.trail.styles.map((l, i) => (i === layerIndex ? next : l))
      }
    })

  return (
    <>
      <div className="mouse-parts" role="radiogroup" aria-label={t('Qué pintar', 'What to paint')}>
        {parts.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={current === p.id}
            className={`mouse-part${current === p.id ? ' is-active' : ''}`}
            onClick={() => {
              setPart(p.id)
              setChip(0)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!layer && current !== 'trail0' && current !== 'trail1' && (
        <>
          <ColorChoices
            value={draft.colors[current as 'fill'] ?? draft.colors.fill}
            accent={accent}
            onPick={(hex) => setColor(current as 'fill', hex)}
          />
          {(current === 'fill' || current === 'fill2') && (
            <label className="settings-check">
              <input
                type="checkbox"
                checked={!!draft.colors.fill2}
                onChange={(e) => {
                  const colors = { ...draft.colors }
                  if (e.target.checked) colors.fill2 = colors.details
                  else delete colors.fill2
                  change({ ...draft, colors })
                  setPart(e.target.checked ? 'fill2' : 'fill')
                }}
              />
              <span>{t('Degradado de 2 colores', '2-color gradient')}</span>
            </label>
          )}
        </>
      )}

      {layer && (
        <>
          <fieldset className="mouse-segmented">
            <legend>{t('Colores de la estela', 'Trail colors')}</legend>
            {(['one', 'alternate', 'rainbow'] as TrailColorMode[]).map((mode) => (
              <label key={mode} className={layer.mode === mode ? 'is-active' : ''}>
                <input
                  type="radio"
                  name="trail-mode"
                  checked={layer.mode === mode}
                  onChange={() => {
                    const colors =
                      mode === 'alternate' && layer.colors.length < 2
                        ? [layer.colors[0], draft.colors.fill]
                        : layer.colors
                    setLayer({ ...layer, mode, colors })
                    setChip(0)
                  }}
                />
                {modeName(mode)}
              </label>
            ))}
          </fieldset>

          {layer.mode === 'rainbow' && <div className="mouse-rainbow-bar" aria-hidden="true" />}

          {layer.mode === 'alternate' && (
            <div className="mouse-chips">
              {layer.colors.map((c, i) => (
                <span key={i} className={`mouse-chip${chip === i ? ' is-active' : ''}`}>
                  <button
                    type="button"
                    style={{ background: c }}
                    aria-label={`${t('Color', 'Color')} ${i + 1}`}
                    onClick={() => setChip(i)}
                  />
                  {layer.colors.length > 1 && (
                    <button
                      type="button"
                      className="mouse-chip-remove"
                      aria-label={t('Quitar este color', 'Remove this color')}
                      onClick={() => {
                        setLayer({ ...layer, colors: layer.colors.filter((_, j) => j !== i) })
                        setChip(0)
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {layer.colors.length < TRAIL_MAX_COLORS && (
                <button
                  type="button"
                  className="mouse-chip-add"
                  aria-label={t('Agregar un color', 'Add a color')}
                  onClick={() => {
                    setLayer({ ...layer, colors: [...layer.colors, layer.colors[0]] })
                    setChip(layer.colors.length)
                  }}
                >
                  +
                </button>
              )}
            </div>
          )}

          {layer.mode !== 'rainbow' && (
            <ColorChoices
              value={layer.colors[Math.min(chip, layer.colors.length - 1)]}
              accent={accent}
              onPick={(hex) => {
                const i = layer.mode === 'one' ? 0 : Math.min(chip, layer.colors.length - 1)
                setLayer({ ...layer, colors: layer.colors.map((c, j) => (j === i ? hex : c)) })
              }}
            />
          )}
        </>
      )}
    </>
  )
}

function TrailTab({
  draft,
  change,
  editColors
}: EditProps & { editColors(i: number): void }): React.JSX.Element {
  const { trail } = draft
  const reduced = useReducedMotion()
  const setTrail = (next: Partial<MouseStyle['trail']>): void =>
    change({ ...draft, trail: { ...trail, ...next } })
  const chosen = trail.on ? trail.styles.map((l) => l.style) : []

  const toggle = (style: TrailStyle): void => {
    if (chosen.includes(style)) {
      const styles = trail.styles.filter((l) => l.style !== style)
      setTrail(styles.length ? { styles } : { on: false })
      return
    }
    const layer: TrailLayer = {
      style,
      mode: style === 'rainbow' ? 'rainbow' : 'one',
      colors: [draft.shape === 'system' ? '#f5c84c' : draft.colors.fill]
    }
    const kept = trail.on ? trail.styles : []
    // Up to 2 at once: a third one takes the place of the second.
    const styles =
      kept.length < TRAIL_MAX_STYLES
        ? [...kept, layer]
        : [...kept.slice(0, TRAIL_MAX_STYLES - 1), layer]
    setTrail({ on: true, styles })
  }

  return (
    <>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={trail.on}
          onChange={(e) => setTrail({ on: e.target.checked })}
        />
        <span>
          {t('Estela detrás del mouse', 'A trail behind the mouse')}
          <small>
            {t(
              'Escoge 1 o mezcla 2 a la vez (por ejemplo brillitos + estrellitas).',
              'Pick 1 or mix 2 at once (for example sparkles + little stars).'
            )}
          </small>
        </span>
      </label>
      {reduced && (
        <small className="mouse-hint is-warning">
          {t(
            'Tu computadora tiene "Reducir movimiento" prendido, así que la estela no se dibuja.',
            'Your computer has "Reduce motion" on, so the trail is not drawn.'
          )}
        </small>
      )}

      <div className="mouse-trail-grid" aria-label={t('Estilos de estela', 'Trail styles')}>
        {TRAIL_STYLES.map((style) => {
          const index = chosen.indexOf(style)
          return (
            <button
              key={style}
              type="button"
              aria-pressed={index >= 0}
              className={`mouse-trail-choice${index >= 0 ? ' is-active' : ''}`}
              onClick={() => toggle(style)}
            >
              {trailName(style)}
              {index >= 0 && <span className="mouse-trail-badge">{index + 1}</span>}
            </button>
          )
        })}
      </div>

      {trail.on &&
        trail.styles.map((layer, i) => (
          <div key={layer.style} className="mouse-layer-row">
            <span>
              {i + 1}. {trailName(layer.style)}
            </span>
            <span className="mouse-layer-colors" aria-hidden="true">
              {layer.mode === 'rainbow' ? (
                <span className="mouse-rainbow-dot" />
              ) : (
                (layer.mode === 'one' ? layer.colors.slice(0, 1) : layer.colors).map((c, j) => (
                  <span key={j} style={{ background: c }} />
                ))
              )}
            </span>
            <button type="button" className="bg-choice is-text" onClick={() => editColors(i)}>
              🎨 {t('Colores', 'Colors')}
            </button>
          </div>
        ))}

      <label className="settings-field">
        <span>
          {t('Largo', 'Length')}: {trail.length}
        </span>
        <input
          type="range"
          className="settings-range"
          min={TRAIL_LENGTH_MIN}
          max={TRAIL_LENGTH_MAX}
          step={1}
          value={trail.length}
          onChange={(e) => setTrail({ length: Number(e.target.value) })}
        />
      </label>

      <fieldset className="mouse-segmented">
        <legend>{t('Se borra', 'Fades')}</legend>
        {(['fast', 'slow'] as const).map((fade) => (
          <label key={fade} className={trail.fade === fade ? 'is-active' : ''}>
            <input
              type="radio"
              name="trail-fade"
              checked={trail.fade === fade}
              onChange={() => setTrail({ fade })}
            />
            {fade === 'fast' ? t('Rápido', 'Fast') : t('Lento', 'Slow')}
          </label>
        ))}
      </fieldset>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={draft.typingPause}
          onChange={(e) => change({ ...draft, typingPause: e.target.checked })}
        />
        <span>{t('No dibujar mientras escribo', "Don't draw while I type")}</span>
      </label>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={draft.focusPause}
          onChange={(e) => change({ ...draft, focusPause: e.target.checked })}
        />
        <span>{t('Pausar durante Focus', 'Pause during Focus')}</span>
      </label>
    </>
  )
}

function FavoritesTab({
  draft,
  favorites,
  chosen,
  load,
  saveFavorites
}: {
  draft: MouseStyle
  favorites: MouseFavorite[]
  chosen: string | null
  load(style: MouseStyle, id: string | null): void
  saveFavorites(list: MouseFavorite[]): void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const full = favorites.length >= MOUSE_FAVORITES_MAX
  const examples = useMemo(() => exampleFavorites(), [])

  const add = (): void => {
    const clean = cleanMouseName(name) ?? `${t('Mi mouse', 'My mouse')} ${favorites.length + 1}`
    const fav = { id: newId(), name: clean, style: structuredClone(draft) }
    saveFavorites([...favorites, fav])
    setName('')
    load(fav.style, fav.id)
  }
  const rename = (id: string): void => {
    const clean = cleanMouseName(newName)
    if (clean) saveFavorites(favorites.map((f) => (f.id === id ? { ...f, name: clean } : f)))
    setRenaming(null)
  }

  return (
    <>
      <form
        className="mouse-fav-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!full) add()
        }}
      >
        <input
          type="text"
          className="settings-input"
          maxLength={MOUSE_NAME_MAX}
          placeholder={t('Nombre (ej. Modo gatito 🐾)', 'Name (e.g. Kitty mode 🐾)')}
          aria-label={t('Nombre del favorito', 'Favorite name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="button-primary" disabled={full}>
          ⭐ {t('Guardar este', 'Save this one')}
        </button>
      </form>
      {full && (
        <small className="mouse-hint">
          {t(
            `Ya tienes ${MOUSE_FAVORITES_MAX}: borra uno para guardar otro.`,
            `You have ${MOUSE_FAVORITES_MAX} already: delete one to save another.`
          )}
        </small>
      )}

      <h4 className="mouse-fav-title">{t('Mis favoritos', 'My favorites')}</h4>
      {favorites.length === 0 && (
        <p className="mouse-empty">
          {t(
            'Todavía no tienes. Viste tu mouse y guárdalo aquí para volver a él con un clic.',
            'None yet. Dress up your mouse and save it here to go back to it in one click.'
          )}
        </p>
      )}
      <ul className="mouse-fav-list">
        {favorites.map((fav) => (
          <li key={fav.id} className={chosen === fav.id ? 'is-active' : ''}>
            {renaming === fav.id ? (
              <input
                type="text"
                className="settings-input"
                autoFocus
                maxLength={MOUSE_NAME_MAX}
                aria-label={t('Nuevo nombre', 'New name')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => rename(fav.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') rename(fav.id)
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setRenaming(null)
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="mouse-fav-load"
                onClick={() => load(fav.style, fav.id)}
              >
                <MouseIcon mouse={fav.style} size={26} />
                <span>{fav.name}</span>
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              title={t('Cambiar el nombre', 'Rename')}
              aria-label={`${t('Cambiar el nombre', 'Rename')}: ${fav.name}`}
              onClick={() => {
                setRenaming(fav.id)
                setNewName(fav.name)
              }}
            >
              ✏️
            </button>
            <button
              type="button"
              className="icon-button"
              title={t('Borrar', 'Delete')}
              aria-label={`${t('Borrar', 'Delete')}: ${fav.name}`}
              onClick={() => saveFavorites(favorites.filter((f) => f.id !== fav.id))}
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>

      <h4 className="mouse-fav-title">{t('Ideas para empezar', 'Ideas to start with')}</h4>
      <ul className="mouse-fav-list">
        {examples.map((fav) => (
          <li key={fav.id} className={chosen === fav.id ? 'is-active' : ''}>
            <button
              type="button"
              className="mouse-fav-load"
              onClick={() => load(fav.style, fav.id)}
            >
              <MouseIcon mouse={fav.style} size={26} />
              <span>{fav.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

// The big try-on area: the draft cursor (and its trail) as you move the mouse over it.
function Preview({
  draft,
  background
}: {
  draft: MouseStyle
  background: string
}): React.JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<TrailEngine | null>(null)
  const reduced = useReducedMotion()
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    if (!canvas || !box) return
    const engine = new TrailEngine(canvas)
    engineRef.current = engine
    const observer = new ResizeObserver(() => engine.resize())
    observer.observe(box)
    ;(window as unknown as { __nuggitPreviewTrail?: TrailEngine }).__nuggitPreviewTrail = engine
    return () => {
      observer.disconnect()
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setTrail(reduced ? null : draft.trail)
  }, [draft.trail, reduced])

  const css = (kind: Parameters<typeof cursorCss>[1], fallback: string): string =>
    cursorCss(draft, kind, background) ?? fallback

  return (
    <div
      ref={boxRef}
      className="mouse-preview"
      data-mouse-preview=""
      style={{ cursor: css('default', 'default') }}
      onPointerMove={(e) => {
        const rect = boxRef.current!.getBoundingClientRect()
        engineRef.current?.move(e.clientX - rect.left, e.clientY - rect.top)
      }}
      onPointerLeave={() => engineRef.current?.lift()}
    >
      <canvas ref={canvasRef} className="mouse-preview-canvas" aria-hidden="true" />
      <p className="mouse-preview-title">
        {t('Mueve el mouse aquí para probártelo ✨', 'Move the mouse here to try it on ✨')}
      </p>
      <div className="mouse-preview-samples">
        <button
          type="button"
          className="button-primary"
          style={{ cursor: css('pointer', 'pointer') }}
        >
          {t('Un botón', 'A button')}
        </button>
        <input
          type="text"
          className="settings-input"
          style={{ cursor: css('text', 'text') }}
          placeholder={t('Escribe aquí…', 'Type here…')}
          aria-label={t('Prueba de texto', 'Text test')}
        />
        <div
          className="mouse-preview-widget"
          style={{ cursor: css(dragging ? 'grabbing' : 'grab', dragging ? 'grabbing' : 'grab') }}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onPointerLeave={() => setDragging(false)}
        >
          {t('Arrástrame (como un widget)', 'Drag me (like a widget)')}
          <span
            className="mouse-preview-resize"
            style={{ cursor: css('resize', 'nwse-resize') }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  )
}
