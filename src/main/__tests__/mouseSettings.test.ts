import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fase 16: what settings.json keeps of the dressed-up mouse, with the disk replaced.
const disk = vi.hoisted(() => ({ settings: {} as unknown }))
vi.mock('../storage/jsonStore', () => ({
  readJson: async () => disk.settings,
  writeJson: async (_name: string, data: unknown) => {
    disk.settings = JSON.parse(JSON.stringify(data))
  }
}))

const { loadSettings, updateSettings } = await import('../storage')
const { DEFAULT_MOUSE } = await import('../../shared/mouse')

describe('mouse settings', () => {
  beforeEach(() => {
    disk.settings = {}
  })

  it('starts with the system cursor, no trail and no favorites', async () => {
    const settings = await loadSettings()
    expect(settings.appearance.mouse).toEqual(DEFAULT_MOUSE)
    expect(settings.mouseFavorites).toEqual([])
  })

  it('cleans a bad mouse saved on disk', async () => {
    disk.settings = {
      appearance: { accent: 'blue', mouse: { shape: 'unicorn', colors: { fill: 'pink' } } },
      mouseFavorites: [{ id: 'x', name: '  Galaxia ✨ ', style: { shape: 'star' } }, 'junk']
    }
    const settings = await loadSettings()
    expect(settings.appearance.accent).toBe('blue')
    expect(settings.appearance.mouse).toEqual(DEFAULT_MOUSE)
    expect(settings.mouseFavorites).toHaveLength(1)
    expect(settings.mouseFavorites[0].name).toBe('Galaxia ✨')
  })

  it('checks what the dress-up sends before keeping it', async () => {
    const saved = await updateSettings({
      appearance: {
        mouse: {
          shape: 'kitty',
          size: 'large',
          colors: { fill: '#FFFFFF', border: '<script>', details: '#ec4899' },
          trail: {
            on: true,
            styles: [{ style: 'paws', mode: 'one', colors: ['#ec4899'] }],
            length: 3.6
          }
        }
      },
      mouseFavorites: [{ id: 'k', name: 'Modo gatito 🐾', style: { shape: 'kitty' } }]
    })
    expect(saved.appearance.mouse.shape).toBe('kitty')
    expect(saved.appearance.mouse.colors.fill).toBe('#ffffff')
    expect(saved.appearance.mouse.colors.border).toBe(DEFAULT_MOUSE.colors.border)
    expect(saved.appearance.mouse.trail.length).toBe(4)
    expect(saved.mouseFavorites.map((f) => f.name)).toEqual(['Modo gatito 🐾'])
    // Other appearance changes leave the mouse alone.
    const after = await updateSettings({ appearance: { widgetShadow: false } })
    expect(after.appearance.mouse.shape).toBe('kitty')
  })
})
