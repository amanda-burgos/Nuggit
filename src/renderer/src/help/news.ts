import changelogEs from '../../../../CHANGELOG.md?raw'
import changelogEn from '../../../../CHANGELOG.en.md?raw'
import { parseChangelog, type ChangelogRelease } from '../../../shared/changelog'
import { getLang, locale, t, type Lang } from '../../../shared/i18n'

// CHANGELOG.md (or CHANGELOG.en.md in English), entry by entry (📣 Novedades, Ayuda → Novedades,
// "Qué hay de nuevo", Acerca de). Both files have the same entries, versions and dates, so
// "seen" dates and versions work the same in either language. Call it when drawing.
const parsed: Partial<Record<Lang, ChangelogRelease[]>> = {}
export function releases(): ChangelogRelease[] {
  const lang = getLang()
  return (parsed[lang] ??= parseChangelog(lang === 'en' ? changelogEn : changelogEs))
}

// "1.0.0" → "Versión 1.0.0"; "Sin publicar" reads better as "Lo más nuevo"; a title stays.
export const releaseName = (version: string): string =>
  /^\d/.test(version)
    ? t(`Versión ${version}`, `Version ${version}`)
    : version === 'Sin publicar'
      ? t('Lo más nuevo', 'Latest')
      : version

// "2026-10-30" → "30 de octubre de 2026" (read as a day here, not as UTC).
export function releaseDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  return new Date(y, m - 1, d).toLocaleDateString(locale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
