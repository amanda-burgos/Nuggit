// Fase 10: CHANGELOG.md read as entries (a version or a dated title), for the 📣 Novedades
// button, Ayuda → Novedades and "Qué hay de nuevo".

export interface ChangelogGroup {
  title: string // "Nuevo", "Arreglado", "Cambió"…
  items: string[] // **bold** allowed
}

export interface ChangelogRelease {
  version: string // "1.0.0", or a title like "Ayuda y tu propio color"
  date?: string // AAAA-MM-DD
  groups: ChangelogGroup[]
}

// "## [1.0.0] - 2026-11-02" → version and date. "- item" lines go in the last "### group".
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = []
  for (const line of markdown.split('\n')) {
    const release = /^## \[?([^\]]+?)\]?(?:\s+[-–]\s+(.+))?\s*$/.exec(line)
    if (release) {
      releases.push({ version: release[1].trim(), date: release[2]?.trim(), groups: [] })
      continue
    }
    const current = releases[releases.length - 1]
    if (!current) continue
    if (line.startsWith('### ')) current.groups.push({ title: line.slice(4).trim(), items: [] })
    else if (line.startsWith('- ')) {
      if (!current.groups.length) current.groups.push({ title: 'Nuevo', items: [] })
      current.groups[current.groups.length - 1].items.push(line.slice(2).trim())
    }
  }
  return releases.filter((r) => r.groups.some((g) => g.items.length))
}

// The release for this version, or the newest one (e.g. "Sin publicar" while developing).
export function releaseFor(releases: ChangelogRelease[], version: string): ChangelogRelease | null {
  return releases.find((r) => r.version === version) ?? releases[0] ?? null
}

// How many entries are newer than the last date you saw in 📣 Novedades (all if never).
export function unseenCount(releases: ChangelogRelease[], lastSeen?: string): number {
  return releases.filter((r) => r.date && (!lastSeen || r.date > lastSeen)).length
}

// The newest date in the changelog (what "seen" is saved as).
export function newestDate(releases: ChangelogRelease[]): string | undefined {
  return releases.reduce<string | undefined>(
    (max, r) => (r.date && (!max || r.date > max) ? r.date : max),
    undefined
  )
}
