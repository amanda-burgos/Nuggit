// Fase 15: "nueva versión disponible". Versions look like "1.2.0" (a tag may be "v1.2.0").

export interface UpdateInfo {
  version: string // "1.1.0"
  url: string // the Release page on GitHub
}

// "v1.2.0" → [1, 2, 0]; null if it isn't a version. Anything after "-" or "+" is ignored.
export function parseVersion(text: string): number[] | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/.exec(text.trim())
  if (!match) return null
  return [match[1], match[2] ?? '0', match[3] ?? '0'].map(Number)
}

// True if `latest` is a higher version than `current` ("1.10.0" > "1.9.0").
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}
