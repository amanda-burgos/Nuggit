import changelog from '../../../../CHANGELOG.md?raw'
import { parseChangelog } from '../../../shared/changelog'

// CHANGELOG.md, entry by entry (📣 Novedades, Ayuda → Novedades, "Qué hay de nuevo", Acerca de).
export const RELEASES = parseChangelog(changelog)

// "1.0.0" → "Versión 1.0.0"; "Sin publicar" reads better as "Lo más nuevo"; a title stays.
export const releaseName = (version: string): string =>
  /^\d/.test(version) ? `Versión ${version}` : version === 'Sin publicar' ? 'Lo más nuevo' : version

// "2026-10-30" → "30 de octubre de 2026" (read as a day here, not as UTC).
export function releaseDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  return new Date(y, m - 1, d).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
