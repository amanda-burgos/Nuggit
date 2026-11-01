import type { AppTab } from '../../../shared/types'
import logoUrl from '../../../../resources/brand/dip-app-icon.svg'
import { TABS } from './tabs'

interface Props {
  tab: AppTab
  collapsed: boolean
  onSelect(tab: AppTab): void
  onToggleCollapsed(): void
  newsCount: number // 📣 entries you haven't seen yet
  onOpenNews(): void
}

// The control center's tabs. Collapsed (or in a narrow window) it shows only icons.
export function Sidebar({
  tab,
  collapsed,
  onSelect,
  onToggleCollapsed,
  newsCount,
  onOpenNews
}: Props): React.JSX.Element {
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
            data-tour={`tab-${t.key}`}
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
        className="sidebar-tab sidebar-news"
        title={newsCount ? `Novedades (${newsCount} sin ver)` : 'Novedades'}
        onClick={onOpenNews}
      >
        <span className="sidebar-icon" aria-hidden>
          📣
          {newsCount > 0 && <span className="sidebar-news-dot" />}
        </span>
        <span className="sidebar-label">Novedades</span>
        {newsCount > 0 && <span className="sidebar-label sidebar-news-count">{newsCount}</span>}
      </button>
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
