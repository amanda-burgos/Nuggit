import type { Background } from '../../../shared/types'
import { imageUrl } from './appearance'
import './background-picker.css'

// Soft colors that suit the navy/lavender style, plus two dark ones.
const SWATCHES = [
  '#fdf6e3',
  '#fff4d6',
  '#fde8ef',
  '#ede8ff',
  '#e8f0ff',
  '#e9f7ef',
  '#26305c',
  '#2b2b33'
]

const log = (err: unknown): void => console.error('[background]', err)

// Choose a background: the normal one, a color, or a picture of your own. With
// `generalLabel`, "null" means "use the general one" (a widget's ⚙︎, Fase 9).
export function BackgroundPicker({
  value,
  onChange,
  generalLabel
}: {
  value: Background | null
  onChange(next: Background | null): void
  generalLabel?: string
}): React.JSX.Element {
  const current = value ?? (generalLabel ? null : { kind: 'default' as const })
  const replace = (next: Background | null): void => {
    // A picture that is replaced isn't needed anymore (unless used somewhere else).
    if (value?.kind === 'image' && !(next?.kind === 'image' && next.image === value.image)) {
      const old = value.image
      setTimeout(() => window.api.images.forget([old]).catch(log), 500)
    }
    onChange(next)
  }

  const pickImage = async (): Promise<void> => {
    const [name] = await window.api.images.pick(false).catch(() => [] as string[])
    if (name) replace({ kind: 'image', image: name })
  }

  const is = (kind: Background['kind'] | 'general', color?: string): boolean =>
    kind === 'general'
      ? current === null
      : current?.kind === kind &&
        (color === undefined || (current.kind === 'color' && current.color === color))

  return (
    <div className="bg-picker" role="group">
      {generalLabel && (
        <button
          type="button"
          className={`bg-choice is-text${is('general') ? ' is-active' : ''}`}
          onClick={() => replace(null)}
        >
          {generalLabel}
        </button>
      )}
      <button
        type="button"
        className={`bg-choice is-text${is('default') ? ' is-active' : ''}`}
        onClick={() => replace({ kind: 'default' })}
      >
        Normal
      </button>
      {SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          className={`bg-choice is-swatch${is('color', color) ? ' is-active' : ''}`}
          style={{ background: color }}
          title={color}
          aria-label={`Color ${color}`}
          onClick={() => replace({ kind: 'color', color })}
        />
      ))}
      <label
        className={`bg-choice is-swatch is-custom${
          current?.kind === 'color' && !SWATCHES.includes(current.color) ? ' is-active' : ''
        }`}
        title="Otro color"
        style={
          current?.kind === 'color' && !SWATCHES.includes(current.color)
            ? { background: current.color }
            : undefined
        }
      >
        <input
          type="color"
          aria-label="Otro color"
          value={current?.kind === 'color' ? current.color : '#ede8ff'}
          onChange={(e) => replace({ kind: 'color', color: e.target.value })}
        />
      </label>
      <button
        type="button"
        className={`bg-choice is-text is-image${is('image') ? ' is-active' : ''}`}
        onClick={pickImage}
      >
        {current?.kind === 'image' ? (
          <>
            <span
              className="bg-thumb"
              style={{ backgroundImage: `url("${imageUrl(current.image)}")` }}
              aria-hidden
            />
            Cambiar imagen
          </>
        ) : (
          '🖼 Imagen…'
        )}
      </button>
    </div>
  )
}
