import { imageUrl } from '../../theme/appearance'
import type { WidgetSettingsProps } from '../types'
import type { ImageConfig } from './ImageWidget'

const INTERVALS = [
  { sec: 5, label: '5 s' },
  { sec: 15, label: '15 s' },
  { sec: 30, label: '30 s' },
  { sec: 60, label: '1 min' },
  { sec: 300, label: '5 min' },
  { sec: 1800, label: '30 min' }
]

const FITS: Array<{ value: ImageConfig['fit']; label: string }> = [
  { value: 'cover', label: 'Rellenar' },
  { value: 'contain', label: 'Ajustar' },
  { value: 'center', label: 'Centrar' }
]

const log = (err: unknown): void => console.error('[image widget]', err)

// The image widget's own options: its pictures, how often they change, how they fit.
export function ImageSettings({
  config,
  updateConfig
}: WidgetSettingsProps<ImageConfig>): React.JSX.Element {
  const { images, intervalSec, fit } = config

  const add = async (): Promise<void> => {
    const picked = await window.api.images.pick(true).catch(() => [] as string[])
    if (picked.length) updateConfig({ images: [...images, ...picked] })
  }

  const remove = (name: string): void => {
    updateConfig({ images: images.filter((n) => n !== name) })
    // Once the widget no longer uses it, the copy is deleted.
    setTimeout(() => window.api.images.forget([name]).catch(log), 800)
  }

  return (
    <div className="image-settings">
      <div className="image-thumbs">
        {images.map((name) => (
          <div key={name} className="image-thumb">
            <img src={imageUrl(name)} alt="" />
            <button className="image-thumb-remove" title="Quitar" onClick={() => remove(name)}>
              ×
            </button>
          </div>
        ))}
        <button className="image-thumb is-add" title="Agregar imágenes" onClick={add}>
          +
        </button>
      </div>

      {images.length > 1 && (
        <label className="image-setting">
          <span>Cambiar cada</span>
          <select
            value={intervalSec}
            onChange={(e) => updateConfig({ intervalSec: Number(e.target.value) })}
          >
            {INTERVALS.map((i) => (
              <option key={i.sec} value={i.sec}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="image-setting" role="radiogroup" aria-label="Cómo se ve">
        {FITS.map((f) => (
          <label key={f.value}>
            <input
              type="radio"
              name="image-fit"
              checked={fit === f.value}
              onChange={() => updateConfig({ fit: f.value })}
            />
            {f.label}
          </label>
        ))}
      </div>
    </div>
  )
}
