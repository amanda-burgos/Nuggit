import type { AppTab } from '../../../shared/types'
import logoUrl from '../../../../resources/brand/nuggit-icon.svg'
import { TABS } from './tabs'

interface Props {
  tab: AppTab
  collapsed: boolean
  onSelect(tab: AppTab): void
  onToggleCollapsed(): void
}

// The control center's tabs. Collapsed (or in a narrow window) it shows only icons.
export function Sidebar({ tab, collapsed, onSelect, onToggleCollapsed }: Props): React.JSX.Element {
  return (
    <nav className={`sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Secciones">
      <div className="sidebar-brand">
        <img className="sidebar-logo" src={logoUrl} alt="" />
        <span className="sidebar-label">Nuggit</span>
      </div>
      <div className="sidebar-tabs" role="tablist" aria-orientation="vertical">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === tab}
            className={`sidebar-tab${t.key === tab ? ' is-active' : ''}`}
            title={t.shortcut ? `${t.label} (⌘${t.shortcut})` : t.label}
            onClick={() => onSelect(t.key)}
          >
            <span className="sidebar-icon" aria-hidden>
              {t.icon}
            </span>
            <span className="sidebar-label">{t.label}</span>
            {t.shortcut && <kbd className="sidebar-label sidebar-shortcut">⌘{t.shortcut}</kbd>}
          </button>
        ))}
      </div>
      <button
        className="sidebar-tab sidebar-toggle"
        title={collapsed ? 'Mostrar nombres' : 'Solo íconos'}
        aria-pressed={collapsed}
        onClick={onToggleCollapsed}
      >
        <span className="sidebar-icon" aria-hidden>
          {collapsed ? '»' : '«'}
        </span>
        <span className="sidebar-label">Solo íconos</span>
      </button>
    </nav>
  )
}
