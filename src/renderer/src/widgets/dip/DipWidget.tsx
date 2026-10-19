import { useEffect, useRef, useState } from 'react'
import type { AIChatResult } from '../../../../shared/types'
import { useDipChat } from '../../store/useDipChat'
import { useSettings } from '../../store/useSettings'
import { MicButton } from '../../voice/MicButton'
import { speak, stopSpeaking } from '../../voice/speech'
import type { WidgetProps } from '../types'
import { ActionCard } from './ActionCard'
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messages = chat?.messages ?? []
  const thinking = chat?.pending ?? false
  const last = messages[messages.length - 1]
  const lastIsUser = last?.role === 'user'
  const { settings, update } = useSettings()
  const speaking = settings?.voice.speak ?? false
  // Only the window that asked reads the answer aloud (the chat is shared by several).
  const [waitingFrom, setWaitingFrom] = useState<string | null>(null)
  const [spokenId, setSpokenId] = useState<string | null>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length, thinking, error])

  // In the menu bar mini chat, typing can start as soon as it opens.
  useEffect(() => {
    if (size !== 'popover') return
    const focus = (): void => inputRef.current?.focus()
    focus()
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [size])

  // SPEC 9.10: with the voice on, Dip's new answer is read aloud once.
  if (
    waitingFrom &&
    last?.role === 'assistant' &&
    last.id !== waitingFrom &&
    last.id !== spokenId &&
    !thinking
  ) {
    setSpokenId(last.id)
    setWaitingFrom(null)
  }
  useEffect(() => {
    const answer = messages.find((m) => m.id === spokenId)
    if (answer && settings?.voice.speak) speak(answer.content, settings.voice)
    // Only when a new answer arrives, not when the settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spokenId])

  // Turning the voice off (or leaving) stops it mid-sentence.
  useEffect(() => {
    if (!speaking) stopSpeaking()
  }, [speaking])
  useEffect(() => () => stopSpeaking(), [])

  const run = async (call: () => Promise<AIChatResult>): Promise<void> => {
    stopSpeaking()
    setWaitingFrom(last?.id ?? 'start')
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
    <div className={`dip is-${size}`}>
      <div className="dip-messages" ref={listRef} aria-live="polite">
        <div className="dip-thread">
          <p className="dip-bubble is-assistant">{GREETING}</p>
          {messages.map((m) => (
            <div key={m.id} className={`dip-message is-${m.role}`}>
              <p className={`dip-bubble is-${m.role}`}>{m.content}</p>
              {m.action && <ActionCard message={m} />}
            </div>
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
        <button
          type="button"
          className="icon-button"
          title={
            speaking ? 'Dip contesta hablando (clic para apagar)' : 'Que Dip conteste hablando'
          }
          aria-pressed={speaking}
          disabled={!settings}
          onClick={() => update({ voice: { speak: !speaking } })}
        >
          {speaking ? '🔊' : '🔇'}
        </button>
        <textarea
          ref={inputRef}
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
        <MicButton target={inputRef} />
        <button type="submit" className="button-primary" disabled={!draft.trim() || thinking}>
          Enviar
        </button>
      </form>
    </div>
  )
}
