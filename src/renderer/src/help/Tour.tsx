import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

// Fase 10: the welcome tour. Bubbles that point at each part of Nuggit, one at a time.
// Each step finds its part by a data-tour attribute (or a class); if it isn't on screen,
// the bubble shows in the middle.

interface Step {
  target: string | null // CSS selector, tried in order; null = no part to point at
  title: string
  text: string
  top?: boolean // about the Mac's menu bar, which lives above the window
}

const STEPS: Step[] = [
  {
    target: '.board',
    title: '👋 ¡Hola! Este es tu tablero',
    text: 'Aquí viven tus widgets: tareas, Dip, Focus, notas… Agrega más con "+ Widget", muévelos arrastrando su encabezado y cámbiales el tamaño desde la esquina.'
  },
  {
    target: '.board .widget-actions, [data-tour="add-widget"]',
    title: '↗ Despégalos a tu escritorio',
    text: 'Con ↗ un widget sale del tablero y se queda en el escritorio de tu Mac, aunque cierres Nuggit. Con ↙ vuelve. 📌 lo fija y ⚙︎ abre sus opciones.'
  },
  {
    target: null,
    top: true,
    title: '⬆ Arriba, en la barra de menú',
    text: 'Nuggit también vive en la barra de menú de tu Mac: ahí ves lo que estás haciendo, abres el mini chat de Dip desde cualquier app y sacas widgets con el 🧩.'
  },
  {
    target: '[data-tour="tab-dip"]',
    title: '💬 Dip, tu compañero',
    text: 'Háblale normal: "anota tarea de inglés para mañana" o "¿qué hago ahora?". Antes de cambiar algo te pide que confirmes. También sabe cómo se usa Nuggit.'
  },
  {
    target: '[data-tour="tab-settings"]',
    title: '⚙︎ Hazla tuya',
    text: 'En Ajustes cambias colores, fondo, la personalidad de Dip y la IA. Y si te pierdes, en ❓ Ayuda está todo explicado (y este tour, por si lo quieres ver otra vez).'
  }
]

const BUBBLE_W = 320
const GAP = 14

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function findTarget(selector: string | null): Box | null {
  if (!selector) return null
  for (const one of selector.split(',')) {
    const el = document.querySelector(one.trim())
    const r = el?.getBoundingClientRect()
    if (r && r.width > 0 && r.height > 0) {
      return { top: r.top, left: r.left, width: r.width, height: r.height }
    }
  }
  return null
}

// Beside the part if it fits (right, then below), inside it if the part is big.
function bubblePlace(box: Box | null, step: Step): React.CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(BUBBLE_W, vw - 32)
  const clampLeft = (x: number): number => Math.max(16, Math.min(x, vw - width - 16))
  const clampTop = (y: number): number => Math.max(16, Math.min(y, vh - 220))
  if (step.top) return { width, top: 16, left: clampLeft(vw / 2 - width / 2) }
  if (!box) return { width, top: vh / 2 - 100, left: clampLeft(vw / 2 - width / 2) }
  const big = box.width * box.height > vw * vh * 0.35
  if (big) {
    return {
      width,
      top: clampTop(box.top + box.height / 2 - 100),
      left: clampLeft(box.left + box.width / 2 - width / 2)
    }
  }
  if (box.left + box.width + GAP + width < vw - 16) {
    return { width, top: clampTop(box.top - 8), left: box.left + box.width + GAP }
  }
  return { width, top: clampTop(box.top + box.height + GAP), left: clampLeft(box.left) }
}

export function Tour({ onDone }: { onDone(): void }): React.JSX.Element {
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  // Measure the part on the next frame (after the step renders), and again on resize.
  useLayoutEffect(() => {
    const measure = (): void => setBox(findTarget(step.target))
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [step.target])

  const next = useCallback(() => (last ? onDone() : setIndex((i) => i + 1)), [last, onDone])
  const back = (): void => setIndex((i) => Math.max(0, i - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDone()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, onDone])

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {box ? (
        <div
          className="tour-spotlight"
          style={{
            top: box.top - 6,
            left: box.left - 6,
            width: box.width + 12,
            height: box.height + 12
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div key={index} className="tour-bubble" style={bubblePlace(box, step)}>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.text}</p>
        <footer className="tour-actions">
          <span className="tour-dots" aria-label={`Paso ${index + 1} de ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span key={i} className={i === index ? 'is-active' : ''} />
            ))}
          </span>
          {!last && (
            <button className="button-ghost" onClick={onDone}>
              Saltar
            </button>
          )}
          {index > 0 && (
            <button className="button-ghost" onClick={back}>
              Atrás
            </button>
          )}
          <button className="button-primary" onClick={next} autoFocus>
            {last ? '¡Listo!' : 'Siguiente'}
          </button>
        </footer>
      </div>
    </div>
  )
}
