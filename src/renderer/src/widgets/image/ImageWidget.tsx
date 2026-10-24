import { useEffect, useState } from 'react'
import { imageUrl } from '../../theme/appearance'
import type { WidgetProps } from '../types'
import './image.css'

export interface ImageConfig {
  images: string[] // copies in Nuggit's data folder
  intervalSec: number // with several: how often it changes
  fit: 'cover' | 'contain' | 'center' // rellenar, ajustar, centrar
}

const log = (err: unknown): void => console.error('[image widget]', err)

// SPEC 9.17: a widget that only shows pictures, to decorate the desktop. One picture, or
// several that take turns. The pictures are copies, so moving the originals is fine.
export function ImageWidget({ config, updateConfig }: WidgetProps<ImageConfig>): React.JSX.Element {
  const { images, intervalSec, fit } = config
  const [index, setIndex] = useState(0)
  const shown = images.length ? index % images.length : 0

  useEffect(() => {
    if (images.length < 2) return
    const timer = setInterval(() => setIndex((i) => i + 1), Math.max(3, intervalSec) * 1000)
    return () => clearInterval(timer)
  }, [images.length, intervalSec])

  if (images.length === 0) {
    return (
      <div className="image-widget is-empty">
        <button
          className="button-primary"
          onClick={() =>
            window.api.images
              .pick(true)
              .then((picked) => picked.length && updateConfig({ images: picked }))
              .catch(log)
          }
        >
          🖼 Elegir imágenes
        </button>
        <small>Una o varias: si eliges varias, van cambiando solas.</small>
      </div>
    )
  }

  return (
    <div className={`image-widget is-${fit}`}>
      {images.map((name, i) => (
        <img
          key={name}
          src={imageUrl(name)}
          alt=""
          draggable={false}
          className={i === shown ? 'is-shown' : undefined}
        />
      ))}
    </div>
  )
}
