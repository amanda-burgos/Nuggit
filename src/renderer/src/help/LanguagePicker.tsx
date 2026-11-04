import type { Lang } from '../../../shared/i18n'
import logoUrl from '../../../../resources/brand/dip-app-icon.svg'
import './language-picker.css'

// Fase 14: the very first screen, before the welcome tour. Both languages are shown at
// once, since we don't know yet which one the person reads.
export function LanguagePicker({ onPick }: { onPick(lang: Lang): void }): React.JSX.Element {
  return (
    <div className="lang-picker" role="dialog" aria-modal="true" aria-labelledby="lang-title">
      <div className="lang-card">
        <img className="lang-icon" src={logoUrl} alt="" />
        <h2 id="lang-title">
          ¿En qué idioma quieres Nuggit?
          <small>Which language do you want Nuggit in?</small>
        </h2>
        <div className="lang-choices">
          <button type="button" className="lang-choice" lang="es" onClick={() => onPick('es')}>
            <span aria-hidden>🇪🇸</span>
            Español
          </button>
          <button type="button" className="lang-choice" lang="en" onClick={() => onPick('en')}>
            <span aria-hidden>🇺🇸</span>
            English
          </button>
        </div>
        <p>
          Lo puedes cambiar después en Ajustes → General.
          <br />
          You can change it later in Settings → General.
        </p>
      </div>
    </div>
  )
}
