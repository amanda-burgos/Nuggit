import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { t } from '../../../shared/i18n'

// Fase 10: the welcome tour. Bubbles that point at each part of Nuggit, one at a time.
// Each step finds its part by a data-tour attribute (or a class); if it isn't on screen,
// the bubble shows in the middle.

interface Step {
  target: string | null // CSS selector, tried in order; null = no part to point at
  title: string
  text: string
  top?: boolean // about the Mac's menu bar, which lives above the window
}

const steps = (): Step[] => [
  {
    target: '.board',
    title: t('👋 ¡Hola! Este es tu tablero', '👋 Hi! This is your board'),
    text: t(
      'Aquí viven tus widgets: tareas, Dip, Focus, notas… Agrega más con "+ Widget", muévelos arrastrando su encabezado y cámbiales el tamaño desde la esquina.',
      'Your widgets live here: tasks, Dip, Focus, notes… Add more with "+ Widget", move them by dragging their header and resize them from the corner.'
    )
  },
  {
    target: '.board .widget-actions, [data-tour="add-widget"]',
    title: t('↗ Despégalos a tu escritorio', '↗ Pop them out onto your desktop'),
    text: t(
      'Con ↗ un widget sale del tablero y se queda en el escritorio de tu Mac, aunque cierres Nuggit. Con ↙ vuelve. 📌 lo fija y ⚙︎ abre sus opciones.',
      "With ↗ a widget leaves the board and stays on your Mac's desktop, even if you close Nuggit. ↙ brings it back. 📌 locks it and ⚙︎ opens its options."
    )
  },
  {
    target: null,
    top: true,
    title: t('⬆ Arriba, en la barra de menú', '⬆ Up top, in the menu bar'),
    text: t(
      'Nuggit también vive en la barra de menú de tu Mac: ahí ves lo que estás haciendo, abres el mini chat de Dip desde cualquier app y sacas widgets con el 🧩.',
      "Nuggit also lives in your Mac's menu bar: there you see what you're doing, open Dip's mini chat from any app and pop out widgets with the 🧩."
    )
  },
  {
    target: '[data-tour="tab-dip"]',
    title: t('💬 Dip, tu compañero', '💬 Dip, your buddy'),
    text: t(
      'Háblale normal: "anota tarea de inglés para mañana" o "¿qué hago ahora?". Antes de cambiar algo te pide que confirmes. También sabe cómo se usa Nuggit.',
      'Talk to it normally: "add an English homework task for tomorrow" or "what should I do now?". Before changing anything it asks you to confirm. It also knows how Nuggit works.'
    )
  },
  {
    target: '[data-tour="tab-settings"]',
    title: t('⚙︎ Hazla tuya', '⚙︎ Make it yours'),
    text: t(
      'En Ajustes cambias colores, fondo, la personalidad de Dip y la IA. Y si te pierdes, en ❓ Ayuda está todo explicado (y este tour, por si lo quieres ver otra vez).',
      "In Settings you change colors, the background, Dip's personality and the AI. And if you get lost, ❓ Help explains everything (plus this tour, in case you want to see it again)."
    )
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
  const STEPS = steps()
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
          <span
            className="tour-dots"
            aria-label={t(
              `Paso ${index + 1} de ${STEPS.length}`,
              `Step ${index + 1} of ${STEPS.length}`
            )}
          >
            {STEPS.map((_, i) => (
              <span key={i} className={i === index ? 'is-active' : ''} />
            ))}
          </span>
          {!last && (
            <button className="button-ghost" onClick={onDone}>
              {t('Saltar', 'Skip')}
            </button>
          )}
          {index > 0 && (
            <button className="button-ghost" onClick={back}>
              {t('Atrás', 'Back')}
            </button>
          )}
          <button className="button-primary" onClick={next} autoFocus>
            {last ? t('¡Listo!', 'Done!') : t('Siguiente', 'Next')}
          </button>
        </footer>
      </div>
    </div>
  )
}
