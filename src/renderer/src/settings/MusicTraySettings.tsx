import { useEffect, useState } from 'react'
import type { PickupTrayMode } from '../../../shared/types'
import type { SectionProps } from './shared'
import { t } from '../../../shared/i18n'

const options = (): Array<{ value: PickupTrayMode; label: string }> => [
  { value: 'icon', label: t('Con su propio ícono 🎵', 'With its own icon 🎵') },
  { value: 'menu', label: t('Dentro del menú de Nuggit', "Inside Nuggit's menu") },
  { value: 'off', label: t('Oculto', 'Hidden') }
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
      <h4>🎵 {t('Música', 'Music')}</h4>
      <fieldset className="settings-choices">
        <legend>
          {t(
            'Un mini reproductor de Spotify, a un clic desde cualquier app.',
            'A mini Spotify player, one click away from any app.'
          )}
        </legend>
        {options().map((o) => (
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
        <small>
          {t(
            'El menú de Nuggit solo aparece mientras tienes algo en curso.',
            "Nuggit's menu only shows up while you have something in progress."
          )}
        </small>
      )}
    </div>
  )
}
