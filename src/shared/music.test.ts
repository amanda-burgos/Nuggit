import { describe, expect, it } from 'vitest'
import { spotifyUri } from './music'

describe('spotify links', () => {
  it('turns shared links and URIs into the URI the app plays', () => {
    const uri = 'spotify:playlist:37i9dQZF1DX8NTLI2TtZa6'
    expect(spotifyUri('https://open.spotify.com/playlist/37i9dQZF1DX8NTLI2TtZa6?si=abc123')).toBe(
      uri
    )
    expect(spotifyUri('https://open.spotify.com/intl-es/playlist/37i9dQZF1DX8NTLI2TtZa6')).toBe(uri)
    expect(spotifyUri('  spotify:playlist:37i9dQZF1DX8NTLI2TtZa6 ')).toBe(uri)
    expect(spotifyUri('https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy')).toBe(
      'spotify:album:4aawyAB9vmqN3uQ7FjRGTy'
    )
  })

  it('rejects anything else', () => {
    expect(spotifyUri('mi playlist de estudio')).toBeNull()
    expect(spotifyUri('https://youtube.com/playlist?list=PL123456789')).toBeNull()
    expect(spotifyUri('https://open.spotify.com/user/someone')).toBeNull()
    expect(spotifyUri('spotify:playlist:')).toBeNull()
  })
})
