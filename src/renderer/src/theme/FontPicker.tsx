import { useEffect, useMemo, useState } from 'react'
import { FONT_PRESETS, MAC_PREFIX, fontStack } from './fonts'
import './font-picker.css'

// Fase 13: the fonts installed on this Mac, asked once per window.
let macFonts: Promise<string[]> | null = null
function useMacFonts(): string[] | null {
  const [list, setList] = useState<string[] | null>(null)
  useEffect(() => {
    let alive = true
    macFonts ??= window.api.fonts.list().catch(() => [])
    macFonts.then((fonts) => alive && setList(fonts))
    return () => {
      alive = false
    }
  }, [])
  return list
}

interface SelectProps {
  value: string | null // null = the general one (only with generalLabel)
  generalLabel?: string
  onChange(font: string | null): void
  ariaLabel?: string
}

// Compact: a dropdown, for a widget's ⚙︎ and "Títulos".
export function FontSelect({
  value,
  generalLabel,
  onChange,
  ariaLabel
}: SelectProps): React.JSX.Element {
  const mac = useMacFonts()
  const isMac = value?.startsWith(MAC_PREFIX)
  return (
    <select
      className="font-select"
      aria-label={ariaLabel ?? 'Letra'}
      value={value ?? ''}
      style={{ fontFamily: value ? fontStack(value) : undefined }}
      onChange={(e) => onChange(e.target.value || null)}
    >
      {generalLabel !== undefined && <option value="">{generalLabel}</option>}
      <optgroup label="Incluidas en Nuggit">
        {FONT_PRESETS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name.es}
          </option>
        ))}
      </optgroup>
      {(mac?.length || isMac) && (
        <optgroup label="De tu Mac">
          {isMac && !mac?.includes(value!.slice(MAC_PREFIX.length)) && (
            <option value={value!}>{value!.slice(MAC_PREFIX.length)}</option>
          )}
          {mac?.map((family) => (
            <option key={family} value={MAC_PREFIX + family}>
              {family}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

// Big: every included font shown in itself, plus a searchable list of the Mac's fonts.
export function FontPicker({
  value,
  onChange
}: {
  value: string
  onChange(font: string): void
}): React.JSX.Element {
  const mac = useMacFonts()
  const [query, setQuery] = useState('')
  const [showMac, setShowMac] = useState(value.startsWith(MAC_PREFIX))
  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (mac ?? []).filter((f) => !q || f.toLowerCase().includes(q))
  }, [mac, query])

  return (
    <div className="font-picker">
      <div className="font-grid" role="radiogroup" aria-label="Letra">
        {FONT_PRESETS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={value === f.id}
            className={`font-choice${value === f.id ? ' is-active' : ''}`}
            style={{ fontFamily: f.stack }}
            onClick={() => onChange(f.id)}
          >
            <span className="font-sample">Aa</span>
            <span className="font-name">{f.name.es}</span>
            <small>{f.hint.es}</small>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="bg-choice is-text font-mac-toggle"
        aria-expanded={showMac}
        onClick={() => setShowMac((v) => !v)}
      >
        {showMac ? '▾' : '▸'} Fuentes de tu Mac
        {value.startsWith(MAC_PREFIX) ? ` · ${value.slice(MAC_PREFIX.length)}` : ''}
      </button>
      {showMac && (
        <div className="font-mac">
          {mac === null ? (
            <small>Buscando las fuentes…</small>
          ) : mac.length === 0 ? (
            <small>No se pudieron leer las fuentes de esta Mac.</small>
          ) : (
            <>
              <input
                type="search"
                className="settings-input"
                placeholder={`Buscar entre ${mac.length} fuentes…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ul className="font-mac-list" role="listbox" aria-label="Fuentes de tu Mac">
                {found.map((family) => {
                  const id = MAC_PREFIX + family
                  return (
                    <li key={family}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === id}
                        className={value === id ? 'is-active' : ''}
                        style={{ fontFamily: fontStack(id) }}
                        onClick={() => onChange(id)}
                      >
                        {family}
                      </button>
                    </li>
                  )
                })}
                {found.length === 0 && <li className="font-mac-empty">Ninguna se llama así.</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
