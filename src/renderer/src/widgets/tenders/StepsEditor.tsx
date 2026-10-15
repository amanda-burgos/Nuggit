import type { TenderStep } from '../../../../shared/types'

export type EditableStep = TenderStep & { key: number }

let nextKey = 100000

interface Props {
  steps: EditableStep[]
  onChange(steps: EditableStep[]): void
}

// Edit, remove, reorder and add steps before saving them.
export function StepsEditor({ steps, onChange }: Props): React.JSX.Element {
  const update = (i: number, patch: Partial<TenderStep>): void =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  const move = (i: number, by: number): void => {
    const next = [...steps]
    const [step] = next.splice(i, 1)
    next.splice(i + by, 0, step)
    onChange(next)
  }

  return (
    <div className="tenders-steps">
      <ol>
        {steps.map((step, i) => (
          <li key={step.key} className="tenders-step">
            <span className="tenders-step-number" aria-hidden>
              {i + 1}
            </span>
            {/* Grows to more lines when the title is long, so it is never cut off. */}
            <textarea
              className="tenders-step-title"
              rows={1}
              value={step.title}
              placeholder="Paso chiquito…"
              aria-label={`Paso ${i + 1}`}
              onChange={(e) => update(i, { title: e.target.value.replace(/\n/g, ' ') })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault()
              }}
            />
            <label className="tenders-step-minutes" title="Minutos">
              <input
                type="number"
                min={1}
                max={600}
                value={step.minutes}
                aria-label={`Minutos del paso ${i + 1}`}
                onChange={(e) =>
                  update(i, { minutes: Math.min(600, Math.max(1, Number(e.target.value) || 1)) })
                }
              />
              min
            </label>
            <div className="tenders-step-actions">
              <button
                className="icon-button"
                title="Subir"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                className="icon-button"
                title="Bajar"
                disabled={i === steps.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                className="icon-button"
                title="Borrar paso"
                onClick={() => onChange(steps.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        className="button-ghost"
        onClick={() => onChange([...steps, { key: nextKey++, title: '', minutes: 10 }])}
      >
        + Añadir paso
      </button>
    </div>
  )
}
