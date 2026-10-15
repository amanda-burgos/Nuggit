import { useEffect, useRef, useState } from 'react'
import type { AIChatResult } from '../../../../shared/types'
import { useDipChat } from '../../store/useDipChat'
import type { WidgetProps } from '../types'
import './dip.css'

// Dip has no options yet.
export type DipConfig = Record<string, never>

const GREETING = '¡Hola! Soy Dip 👋 Pregúntame lo que quieras, o cuéntame qué tienes pendiente.'

const failed = (): AIChatResult => ({ ok: false, error: 'Algo salió mal. Intenta otra vez.' })

// A chat with Dip. Small on the board, big in the Dip tab; same conversation in both.
export function DipWidget({ size }: WidgetProps<DipConfig>): React.JSX.Element {
  const chat = useDipChat()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const messages = chat?.messages ?? []
  const thinking = chat?.pending ?? false
  const lastIsUser = messages[messages.length - 1]?.role === 'user'

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length, thinking, error])

  const run = async (call: () => Promise<AIChatResult>): Promise<void> => {
    setError(null)
    const result = await call().catch(failed)
    if (!result.ok) setError(result.error)
  }

  const send = (): void => {
    const text = draft.trim()
    if (!text || thinking) return
    setDraft('')
    run(() => window.api.dipChat.send(text))
  }

  const clear = (): void => {
    if (!window.confirm('¿Empezar una conversación nueva? Se borra el historial con Dip.')) return
    setError(null)
    window.api.dipChat.clear().catch((err) => console.error('Could not clear chat', err))
  }

  return (
    <div className={`dip${size === 'full' ? ' is-full' : ''}`}>
      <div className="dip-messages" ref={listRef} aria-live="polite">
        <div className="dip-thread">
          <p className="dip-bubble is-assistant">{GREETING}</p>
          {messages.map((m) => (
            <p key={m.id} className={`dip-bubble is-${m.role}`}>
              {m.content}
            </p>
          ))}
          {thinking && <p className="dip-bubble is-assistant is-thinking">Dip está pensando…</p>}
          {!thinking && (error || lastIsUser) && (
            <div className="dip-error" role="alert">
              <p>{error ?? 'Dip no alcanzó a contestar.'}</p>
              <button className="button-ghost" onClick={() => run(window.api.dipChat.retry)}>
                Reintentar
              </button>
            </div>
          )}
        </div>
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
            onClick={clear}
          >
            ↺
          </button>
        )}
        <textarea
          rows={1}
          value={draft}
          placeholder="Escríbele a Dip…"
          aria-label="Mensaje para Dip"
          autoFocus={size === 'full'}
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
