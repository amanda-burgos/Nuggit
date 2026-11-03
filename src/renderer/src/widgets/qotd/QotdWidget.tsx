import { useEffect, useRef, useState } from 'react'
import {
  QOTD_KINDS,
  allTopics,
  customTopicId,
  normalizeTopic,
  keyDate,
  keyTopic,
  qotdForDip,
  qotdKey,
  questionOfDay,
  topicQuestion,
  type QotdKind,
  type QotdTopic
} from '../../../../shared/qotd'
import type { QotdState } from '../../../../shared/types'
import { releaseDate } from '../../help/news'
import { useQotd } from '../../store/useQotd'
import { useSettings } from '../../store/useSettings'
import { useToday } from '../../store/useToday'
import type { WidgetProps, WidgetSettingsProps } from '../types'
import './qotd.css'

export interface QotdConfig {
  topic?: string // the widget shows this topic's question; unset or '' = the general one
}

const SAVE_DELAY_MS = 600

const kindInfo = (kind?: string): { icon: string; label: string } =>
  QOTD_KINDS[kind as QotdKind] ?? QOTD_KINDS.pensar

// Fase 11: the question of the day. The tab shows the general question plus one card per
// topic you like (Matemáticas, Historia… or one you write yourself), and you answer the
// ones you want. The widget shows one card (the general one, or the topic in its ⚙︎).
export function QotdWidget({ size, config }: WidgetProps<QotdConfig>): React.JSX.Element {
  const state = useQotd()
  const today = useToday()
  const { settings, update } = useSettings()
  const [picking, setPicking] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  if (!state || !settings) return <div className="qotd" />

  const { qotdTopics, qotdCustomTopics } = settings
  const topics = allTopics(qotdCustomTopics)
  const mine = qotdTopics
    .map((id) => topics.find((t) => t.id === id))
    .filter((t): t is QotdTopic => Boolean(t))

  if (size !== 'full') {
    const topic = topics.find((t) => t.id === config.topic)
    return (
      <div className="qotd">
        <Card state={state} date={today} topic={topic} />
      </div>
    )
  }

  const toggle = (id: string): void => {
    const chosen = qotdTopics.includes(id)
      ? qotdTopics.filter((t) => t !== id)
      : [...qotdTopics, id]
    update({ qotdTopics: chosen })
  }

  // A topic you write: it's turned on right away. If it already exists (even as one of the
  // built-in ones, accents or not), that one is turned on instead.
  const addTopic = (e: React.FormEvent): void => {
    e.preventDefault()
    const label = newTopic.trim().slice(0, 40)
    if (!label) return
    const same = topics.find((t) => normalizeTopic(t.label) === normalizeTopic(label))
    setNewTopic('')
    if (same) {
      if (!qotdTopics.includes(same.id)) update({ qotdTopics: [...qotdTopics, same.id] })
      return
    }
    const id = customTopicId(
      label,
      topics.map((t) => t.id)
    )
    update({
      qotdCustomTopics: [...qotdCustomTopics, { id, label }],
      qotdTopics: [...qotdTopics, id]
    })
  }

  const removeTopic = (id: string): void =>
    update({
      qotdCustomTopics: qotdCustomTopics.filter((t) => t.id !== id),
      qotdTopics: qotdTopics.filter((t) => t !== id)
    })

  return (
    <div className="qotd is-full">
      <div className="qotd-topics-bar">
        <span className="qotd-hint">
          {mine.length
            ? 'Contesta las que quieras: ninguna es obligatoria.'
            : 'Escoge temas que te gustan y cada uno tendrá su propia pregunta del día.'}
        </span>
        <button className="button-ghost" onClick={() => setPicking((p) => !p)}>
          {picking ? 'Listo' : '✏️ Mis temas'}
        </button>
      </div>
      {picking && (
        <div className="qotd-topic-picker" role="group" aria-label="Temas que te gustan">
          {topics.map((t) => {
            const on = qotdTopics.includes(t.id)
            const yours = qotdCustomTopics.some((c) => c.id === t.id)
            return (
              <span key={t.id} className={`qotd-topic-chip${on ? ' is-on' : ''}`}>
                <button aria-pressed={on} onClick={() => toggle(t.id)}>
                  {t.icon} {t.label}
                </button>
                {yours && (
                  <button
                    className="qotd-topic-remove"
                    title={`Borrar "${t.label}"`}
                    aria-label={`Borrar el tema ${t.label}`}
                    onClick={() => removeTopic(t.id)}
                  >
                    ×
                  </button>
                )}
              </span>
            )
          })}
          <form className="qotd-topic-new" onSubmit={addTopic}>
            <input
              value={newTopic}
              maxLength={40}
              placeholder="Otro tema: K-pop, química…"
              aria-label="Escribe un tema que te guste"
              onChange={(e) => setNewTopic(e.target.value)}
            />
            <button className="button-primary" type="submit" disabled={!newTopic.trim()}>
              + Agregar
            </button>
          </form>
        </div>
      )}
      <div className="qotd-cards">
        <Card state={state} date={today} />
        {mine.map((t) => (
          <Card key={t.id} state={state} date={today} topic={t} />
        ))}
      </div>
      <History state={state} today={today} topics={topics} />
    </div>
  )
}

// One question: the general one, or a topic's.
function Card({
  state,
  date,
  topic
}: {
  state: QotdState
  date: string
  topic?: QotdTopic
}): React.JSX.Element | null {
  const key = qotdKey(date, topic?.id)
  const day = state[key]
  const generated = topic
    ? topicQuestion(topic, date, day?.skip ?? 0)
    : questionOfDay(date, day?.skip ?? 0)
  if (!generated) return null
  // Once answered, it stays the question you answered (even if the bank changes).
  const question = day?.answer && day.question ? day.question : generated.text
  const kind = day?.answer && day.kind ? day.kind : generated.kind
  const answered = Boolean(day?.answer?.trim())

  const talk = (answer: string): void => {
    window.api.app.openTab('dip')
    window.api.dipChat
      .send(qotdForDip(question, answer, topic?.label))
      .catch((err) => console.error('Could not send the question to Dip', err))
  }

  return (
    <section className={`qotd-card${topic ? ' is-topic' : ''}`}>
      <span className="qotd-kind">
        {topic ? `${topic.icon} ${topic.label}` : `${kindInfo(kind).icon} ${kindInfo(kind).label}`}
      </span>
      <p className="qotd-question">{question}</p>
      <Answer
        key={`${key}:${question}`}
        cardKey={key}
        question={question}
        kind={kind}
        saved={day?.answer ?? ''}
        onTalk={talk}
        onSkip={
          answered ? undefined : () => window.api.qotd.skip(key).catch((err) => console.error(err))
        }
      />
    </section>
  )
}

function Answer({
  cardKey,
  question,
  kind,
  saved,
  onTalk,
  onSkip
}: {
  cardKey: string
  question: string
  kind: string
  saved: string
  onTalk(answer: string): void
  onSkip?: () => void
}): React.JSX.Element {
  // What is being typed; null when not editing, to show changes from other windows.
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? saved
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)

  const save = (): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const answer = pending.current
    pending.current = null
    if (answer === null) return
    window.api.qotd
      .answer(cardKey, { question, kind, answer })
      .catch((err) => console.error('Could not save the answer', err))
  }
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  // Whatever is still waiting gets saved when this goes away.
  useEffect(() => () => saveRef.current(), [])

  const change = (value: string): void => {
    setDraft(value)
    pending.current = value
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, SAVE_DELAY_MS)
  }

  return (
    <>
      <textarea
        className="qotd-answer"
        value={text}
        placeholder="Tu respuesta (opcional)…"
        aria-label="Tu respuesta"
        rows={3}
        onChange={(e) => change(e.target.value)}
        onBlur={() => {
          save()
          setDraft(null)
        }}
      />
      <div className="qotd-actions">
        {onSkip && (
          <button className="button-ghost" onClick={onSkip} title="Otra pregunta para hoy">
            🔀 Otra
          </button>
        )}
        <button
          className="button-primary"
          onClick={() => {
            save()
            onTalk(text)
          }}
        >
          💬 Platicar con Dip
        </button>
      </div>
    </>
  )
}

// Your answers from other days, newest first.
function History({
  state,
  today,
  topics
}: {
  state: QotdState
  today: string
  topics: QotdTopic[]
}): React.JSX.Element {
  const past = Object.entries(state)
    .filter(([key, day]) => keyDate(key) !== today && day.answer?.trim() && day.question)
    .sort(([a], [b]) => b.localeCompare(a))

  return (
    <section className="qotd-history">
      <h2>Tus respuestas</h2>
      {past.length === 0 ? (
        <p className="qotd-hint">
          Aquí se van guardando tus respuestas de cada día. ¡Las de hoy son las primeras!
        </p>
      ) : (
        <ul>
          {past.map(([key, day]) => {
            const topicId = keyTopic(key)
            const topic = topics.find((t) => t.id === topicId)
            return (
              <li key={key} className="qotd-past">
                <time dateTime={keyDate(key)}>
                  {topic
                    ? `${topic.icon} ${topic.label}`
                    : topicId
                      ? '⭐'
                      : kindInfo(day.kind).icon}{' '}
                  · {releaseDate(keyDate(key))}
                </time>
                <strong>{day.question}</strong>
                <p>{day.answer}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// The widget's ⚙︎: which question it shows.
export function QotdSettings({
  config,
  updateConfig
}: WidgetSettingsProps<QotdConfig>): React.JSX.Element {
  const { settings } = useSettings()
  return (
    <label className="qotd-setting">
      Pregunta que muestra
      <select value={config.topic ?? ''} onChange={(e) => updateConfig({ topic: e.target.value })}>
        <option value="">💭 La general</option>
        {allTopics(settings?.qotdCustomTopics).map((t) => (
          <option key={t.id} value={t.id}>
            {t.icon} {t.label}
          </option>
        ))}
      </select>
    </label>
  )
}
