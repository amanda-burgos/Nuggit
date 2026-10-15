import { useEffect, useRef, useState } from 'react'
import type { AIMessage } from '../../../../shared/types'
import './dip.css'

// Dip has no options yet.
export type DipConfig = Record<string, never>

type ChatMessage = AIMessage & { id: number }

const GREETING = '¡Hola! Soy Dip 👋 Pregúntame lo que quieras, o cuéntame qué tienes pendiente.'

let nextId = 1

// A small chat with Dip. The conversation lives only while the widget is open.
export function DipWidget(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, thinking, error])

  const ask = async (history: ChatMessage[]): Promise<void> => {
    setThinking(true)
    setError(null)
    const result = await window.api.ai
      .chat(history.map(({ role, content }) => ({ role, content })))
      .catch(() => ({ ok: false as const, error: 'Algo salió mal. Intenta otra vez.' }))
    setThinking(false)
    if (result.ok) {
      setMessages([...history, { id: nextId++, role: 'assistant', content: result.text }])
    } else {
      setError(result.error)
    }
  }

  const send = (): void => {
    const text = draft.trim()
    if (!text || thinking) return
    const history = [...messages, { id: nextId++, role: 'user' as const, content: text }]
    setMessages(history)
    setDraft('')
    ask(history)
  }

  return (
    <div className="dip">
      <div className="dip-messages" ref={listRef} aria-live="polite">
        <p className="dip-bubble is-assistant">{GREETING}</p>
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
      </div>

      <form
        className="dip-input"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        {messages.length > 0 && (
          <button
            type="button"
            className="icon-button"
            title="Nueva conversación"
            disabled={thinking}
            onClick={() => {
              setMessages([])
              setError(null)
            }}
          >
            ↺
          </button>
        )}
        <textarea
          rows={1}
          value={draft}
          placeholder="Escríbele a Dip…"
          aria-label="Mensaje para Dip"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button type="submit" className="button-primary" disabled={!draft.trim() || thinking}>
          Enviar
        </button>
      </form>
    </div>
  )
}
