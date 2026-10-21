// SPEC 9.19: the Spotify link the person pastes in Ajustes → Música, as the URI the
// Spotify app plays ("spotify:playlist:…"). Shared so it can be tested.

const KINDS = ['playlist', 'album', 'artist', 'track', 'show', 'episode']
const ID = /^[A-Za-z0-9]{10,40}$/

// Accepts "https://open.spotify.com/playlist/37i9…?si=…", the same with "/intl-es/",
// "spotify:playlist:37i9…" or "spotify://playlist/37i9…". Anything else → null.
export function spotifyUri(input: string): string | null {
  const text = input.trim()
  const fromUri = /^spotify:(?:\/\/)?([a-z]+)[:/]([A-Za-z0-9]+)/.exec(text)
  if (fromUri && KINDS.includes(fromUri[1]) && ID.test(fromUri[2])) {
    return `spotify:${fromUri[1]}:${fromUri[2]}`
  }
  try {
    const url = new URL(text)
    if (!/(^|\.)spotify\.com$/.test(url.hostname)) return null
    const parts = url.pathname.split('/').filter(Boolean)
    const at = parts.findIndex((p) => KINDS.includes(p))
    if (at === -1 || !ID.test(parts[at + 1] ?? '')) return null
    return `spotify:${parts[at]}:${parts[at + 1]}`
  } catch {
    return null
  }
}
