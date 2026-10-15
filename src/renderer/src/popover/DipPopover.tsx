import { useEffect } from 'react'
import { AINotice } from '../desktop/AINotice'
import { useAIStatus } from '../store/useAIStatus'
import { useSettings } from '../store/useSettings'
import { DipWidget } from '../widgets/dip/DipWidget'
import './popover.css'

const close = (): void => window.api.popover.hide()

// SPEC 9.15: the mini chat that opens from Dip's menu bar icon. Same conversation and same
// action cards as the Dip tab. Closes with its X, with Esc, or by clicking outside.
export function DipPopover(): React.JSX.Element {
  useSettings() // follows the app's theme
  const aiStatus = useAIStatus()

  useEffect(() => {
    document.title = 'Dip'
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="popover">
      <header className="popover-header">
        <span className="popover-title">
          <span aria-hidden>🫙</span> Dip
        </span>
        <button className="icon-button" title="Cerrar (Esc)" onClick={close}>
          ×
        </button>
      </header>
      <div className="popover-body">
        {aiStatus && !aiStatus.active ? (
          <AINotice />
        ) : (
          <DipWidget
            instanceId="popover"
            size="popover"
            config={{}}
            updateConfig={() => undefined}
          />
        )}
      </div>
    </div>
  )
}
