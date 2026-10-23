import { useEffect, useState } from 'react'
import type { PickupTrayMode } from '../../../shared/types'
import type { SectionProps } from './shared'

const OPTIONS: Array<{ value: PickupTrayMode; label: string }> = [
  { value: 'icon', label: 'Con su propio ícono 🎵' },
  { value: 'menu', label: 'Dentro del menú de Nuggit' },
  { value: 'off', label: 'Oculto' }
]

// SPEC 9.19: where the music mini player lives in the menu bar.
export function MusicTraySettings({ settings, update }: SectionProps): React.JSX.Element {
  // Not chosen yet: the icon shows only if Spotify is on this Mac (as the main process does).
  const [spotify, setSpotify] = useState<boolean | null>(null)
  useEffect(() => {
    window.api.music
      .status(false)
      .then((s) => setSpotify(s.app !== 'not-installed'))
      .catch(() => setSpotify(false))
  }, [])
  const current = settings.musicTray ?? (spotify === false ? 'off' : 'icon')

  return (
    <div className="settings-subsection">
      <h4>🎵 Música</h4>
      <fieldset className="settings-choices">
        <legend>Un mini reproductor de Spotify, a un clic desde cualquier app.</legend>
        {OPTIONS.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name="music-tray"
              checked={current === o.value}
              onChange={() => update({ musicTray: o.value })}
            />
            {o.label}
          </label>
        ))}
      </fieldset>
      {current === 'menu' && (
        <small>El menú de Nuggit solo aparece mientras tienes algo en curso.</small>
      )}
    </div>
  )
}
