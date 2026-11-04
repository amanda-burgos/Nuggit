import type { AppTab } from '../../../shared/types'
import logoUrl from '../../../../resources/brand/dip-app-icon.svg'
import { t } from '../../../shared/i18n'
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
    <nav
      className={`sidebar${collapsed ? ' is-collapsed' : ''}`}
      aria-label={t('Secciones', 'Sections')}
    >
      <div className="sidebar-brand">
        <img className="sidebar-logo" src={logoUrl} alt="" />
        <span className="sidebar-label">Nuggit</span>
      </div>
      <div className="sidebar-tabs" role="tablist" aria-orientation="vertical">
        {TABS.map((info) => (
          <button
            key={info.key}
            role="tab"
            data-tour={`tab-${info.key}`}
            aria-selected={info.key === tab}
            className={`sidebar-tab${info.key === tab ? ' is-active' : ''}`}
            title={info.shortcut ? `${info.label} (⌘${info.shortcut})` : info.label}
            onClick={() => onSelect(info.key)}
          >
            <span className="sidebar-icon" aria-hidden>
              {info.icon}
            </span>
            <span className="sidebar-label">{info.label}</span>
            {info.shortcut && (
              <kbd className="sidebar-label sidebar-shortcut">⌘{info.shortcut}</kbd>
            )}
          </button>
        ))}
      </div>
      <button
        className="sidebar-tab sidebar-news"
        title={
          newsCount
            ? t(`Novedades (${newsCount} sin ver)`, `What's new (${newsCount} unseen)`)
            : t('Novedades', "What's new")
        }
        onClick={onOpenNews}
      >
        <span className="sidebar-icon" aria-hidden>
          📣
          {newsCount > 0 && <span className="sidebar-news-dot" />}
        </span>
        <span className="sidebar-label">{t('Novedades', "What's new")}</span>
        {newsCount > 0 && <span className="sidebar-label sidebar-news-count">{newsCount}</span>}
      </button>
      <button
        className="sidebar-tab sidebar-toggle"
        title={collapsed ? t('Mostrar nombres', 'Show names') : t('Solo íconos', 'Icons only')}
        aria-pressed={collapsed}
        onClick={onToggleCollapsed}
      >
        <span className="sidebar-icon" aria-hidden>
          {collapsed ? '»' : '«'}
        </span>
        <span className="sidebar-label">{t('Solo íconos', 'Icons only')}</span>
      </button>
    </nav>
  )
}
