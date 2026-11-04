import type { RefObject } from 'react'
import './voice.css'
import { t } from '../../../shared/i18n'

const IS_MAC = navigator.userAgent.includes('Mac')

// 🎤 Talk instead of typing (SPEC 9.10): puts the cursor in the text field and starts the
// Mac's dictation there. Pressing Fn (🌐) twice does the same from anywhere.
export function MicButton({
  target,
  disabled
}: {
  target: RefObject<HTMLTextAreaElement | HTMLInputElement | null>
  disabled?: boolean
}): React.JSX.Element | null {
  if (!IS_MAC) return null
  return (
    <button
      type="button"
      className="icon-button mic-button"
      title={t('Dictar (o pulsa Fn dos veces)', 'Dictate (or press Fn twice)')}
      aria-label={t('Dictar', 'Dictate')}
      disabled={disabled}
      // Keeps the cursor in the text field, where the dictated words go.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        const field = target.current
        if (!field) return
        field.focus()
        field.setSelectionRange(field.value.length, field.value.length)
        window.api.voice.dictate().catch((err) => console.error('Could not start dictation', err))
      }}
    >
      🎤
    </button>
  )
}
