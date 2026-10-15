import type { Settings, SettingsPatch } from '../../../shared/types'

export interface SectionProps {
  settings: Settings
  update(patch: SettingsPatch): void
}

export type Status = { kind: 'ok' | 'error' | 'info'; text: string } | null

export function StatusMessage({ status }: { status: Status }): React.JSX.Element | null {
  if (!status) return null
  return (
    <p className={`settings-status is-${status.kind}`} role="status">
      {status.text}
    </p>
  )
}
