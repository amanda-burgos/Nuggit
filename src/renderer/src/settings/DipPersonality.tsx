import { useEffect, useRef, useState } from 'react'
import type { AIMessage } from '../../../shared/types'
import { useAIStatus } from '../store/useAIStatus'
import { DipIcon } from '../theme/DipIcon'
import { StatusMessage, type SectionProps, type Status } from './shared'

const MAX_LENGTH = 1500

type ChatMessage = AIMessage & { id: number }
let nextId = 1

// SPEC 9.12: change how Dip is, by writing it in the box or by asking Dip. Dip's proposal is
// only saved after the user approves it.
export function DipPersonality({ settings, update }: SectionProps): React.JSX.Element {
  const saved = settings.dipPersonality ?? ''
  const [draft, setDraft] = useState(saved)
  const [status, setStatus] = useState<Status>(null)
  const dirty = draft.trim() !== saved

  const save = (text: string): void => {
    update({ dipPersonality: text.trim() || null })
    setDraft(text.trim())
    setStatus({
      kind: 'ok',
      text: text.trim()
        ? 'Guardado. Pruébalo hablando con Dip en su widget ✨'
        : 'Listo: Dip vuelve a ser el original.'
    })
  }

  const restore = (): void => {
    if (!window.confirm('¿Restaurar a Dip original? Se borran tus cambios de personalidad.')) return
    save('')
  }

  return (
    <section className="settings-section">
      <h3>
        <DipIcon /> Dip
      </h3>
      <p className="settings-hint">
        Cambia cómo es Dip. Hay cosas que no cambian: nunca te regaña ni cambia tus datos sin
        preguntarte.
      </p>

      <label className="settings-field">
        <span>Cómo quieres que sea Dip</span>
        <textarea
          className="personality-box"
          value={draft}
          rows={4}
          maxLength={MAX_LENGTH}
          placeholder={
            'Ej: Háblame en inglés. Usa muchos emojis. Sé más directo.\n(Vacío = Dip original)'
          }
          onChange={(e) => {
            setDraft(e.target.value)
            setStatus(null)
          }}
        />
      </label>
      <div className="settings-row">
        <button className="button-primary" disabled={!dirty} onClick={() => save(draft)}>
          Guardar
        </button>
        {dirty && (
          <button className="button-ghost" onClick={() => setDraft(saved)}>
            Deshacer cambios
          </button>
        )}
        {saved && (
          <button className="button-ghost" onClick={restore}>
            Restaurar Dip original
          </button>
        )}
      </div>
      <StatusMessage status={status} />

      <PersonalityChat onApprove={save} />
    </section>
  )
}

// A mini chat: the user says how Dip should be, Dip proposes the full text.
function PersonalityChat({ onApprove }: { onApprove(text: string): void }): React.JSX.Element {
  const aiStatus = useAIStatus()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const available = Boolean(aiStatus?.active)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, thinking, proposal, error])

  const ask = async (history: ChatMessage[]): Promise<void> => {
    setThinking(true)
    setError(null)
    setProposal(null)
    const result = await window.api.ai
      .proposePersonality(history.map(({ role, content }) => ({ role, content })))
      .catch(() => ({ ok: false as const, error: 'Algo salió mal. Intenta otra vez.' }))
    setThinking(false)
    if (!result.ok) return setError(result.error)
    setMessages([...history, { id: nextId++, role: 'assistant', content: result.reply }])
    setProposal(result.personality)
  }

  const send = (): void => {
    const text = input.trim()
    if (!text || thinking) return
    const history = [...messages, { id: nextId++, role: 'user' as const, content: text }]
    setMessages(history)
    setInput('')
    ask(history)
  }

  return (
    <div className="personality-chat">
      <div className="settings-field">
        <span>O díselo a Dip</span>
        <small>
          {available
            ? 'Ej: "háblame como pirata" o "quiero que seas más directo". Dip te propone el texto y tú lo apruebas.'
            : 'Para esto Dip necesita una IA disponible (arriba). Mientras, puedes escribir en la cajita.'}
        </small>
      </div>

      {(messages.length > 0 || thinking || error) && (
        <div className="personality-messages" ref={listRef} aria-live="polite">
          {messages.map((m) => (
            <p key={m.id} className={`dip-bubble is-${m.role}`}>
              {m.content}
            </p>
          ))}
          {thinking && <p className="dip-bubble is-assistant is-thinking">Dip está pensando…</p>}
          {error && (
            <div className="dip-error" role="alert">
              <p>{error}</p>
              <button className="button-ghost" onClick={() => ask(messages)}>
                Reintentar
              </button>
            </div>
          )}
          {proposal && (
            <div className="personality-proposal">
              <span className="settings-hint">Nueva personalidad:</span>
              <p>{proposal}</p>
              <div className="settings-row">
                <button
                  className="button-primary"
                  onClick={() => {
                    onApprove(proposal)
                    setProposal(null)
                  }}
                >
                  Aprobar y guardar
                </button>
                <button className="button-ghost" onClick={() => setProposal(null)}>
                  Descartar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <form
        className="settings-row"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          className="personality-input"
          value={input}
          placeholder="¿Cómo quieres que sea Dip?"
          aria-label="Pídele a Dip un cambio de personalidad"
          disabled={!available}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="button-primary"
          disabled={!available || !input.trim() || thinking}
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
