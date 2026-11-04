import { describe, expect, it } from 'vitest'
import { MOUSE_SHAPES, TRAIL_STYLES } from './types'
import {
  DEFAULT_MOUSE,
  cleanMouse,
  cleanMouseFavorites,
  exampleFavorites,
  randomMouse
} from './mouse'

const HEX = /^#[0-9a-f]{6}$/

describe('cleanMouse', () => {
  it('gives the system cursor with no trail for nothing saved', () => {
    expect(cleanMouse(undefined)).toEqual(DEFAULT_MOUSE)
    expect(cleanMouse('arrow')).toEqual(DEFAULT_MOUSE)
    expect(DEFAULT_MOUSE.shape).toBe('system')
    expect(DEFAULT_MOUSE.trail.on).toBe(false)
  })

  it('fixes a bad mouse object part by part', () => {
    const mouse = cleanMouse({
      shape: 'dragon',
      size: 'huge',
      colors: { fill: 'red', fill2: '#ABCDEF', border: '#12345', details: 42 },
      trail: {
        on: 'yes',
        styles: [
          { style: 'sparkles', mode: 'disco', colors: ['#FF0000', 'blue', '#00ff00', 1] },
          { style: 'sparkles', mode: 'one', colors: [] }, // the same style twice
          { style: 'lasers', mode: 'one', colors: ['#ffffff'] },
          { style: 'hearts', mode: 'alternate', colors: Array(9).fill('#111111') },
          { style: 'stars', mode: 'one', colors: ['#ffffff'] } // a third one
        ],
        length: 99,
        fade: 'never'
      },
      typingPause: 'no',
      focusPause: false
    })
    expect(mouse.shape).toBe('system')
    expect(mouse.size).toBe('medium')
    expect(mouse.colors).toEqual({
      fill: DEFAULT_MOUSE.colors.fill,
      fill2: '#abcdef',
      border: DEFAULT_MOUSE.colors.border,
      details: DEFAULT_MOUSE.colors.details
    })
    expect(mouse.trail.on).toBe(false)
    expect(mouse.trail.styles.map((l) => l.style)).toEqual(['sparkles', 'hearts'])
    expect(mouse.trail.styles[0]).toEqual({
      style: 'sparkles',
      mode: 'one',
      colors: ['#ff0000', '#00ff00']
    })
    expect(mouse.trail.styles[1].colors).toHaveLength(4)
    expect(mouse.trail.length).toBe(10)
    expect(mouse.trail.fade).toBe('slow')
    expect(mouse.typingPause).toBe(true)
    expect(mouse.focusPause).toBe(false)
  })

  it('keeps a good style as it is', () => {
    for (const fav of exampleFavorites()) expect(cleanMouse(fav.style)).toEqual(fav.style)
  })

  it('clamps the length and gives a trail with no layers the default one', () => {
    const mouse = cleanMouse({ shape: 'paw', trail: { on: true, styles: [], length: -3 } })
    expect(mouse.shape).toBe('paw')
    expect(mouse.trail.length).toBe(1)
    expect(mouse.trail.styles).toEqual(DEFAULT_MOUSE.trail.styles)
  })
})

describe('cleanMouseFavorites', () => {
  it('drops bad entries, trims names and keeps up to 30', () => {
    expect(cleanMouseFavorites('nope')).toBeNull()
    const list = cleanMouseFavorites([
      { id: 'a', name: '   Modo   gatito 🐾  ', style: { shape: 'paw' } },
      { id: 'a', name: 'same id', style: {} },
      { id: 'b', name: '   ', style: {} },
      { id: 'bad id!', name: 'x', style: {} },
      { id: 'c', name: 'x'.repeat(80), style: 'junk' },
      null
    ])!
    expect(list.map((f) => f.id)).toEqual(['a', 'c'])
    expect(list[0].name).toBe('Modo gatito 🐾')
    expect(list[0].style.shape).toBe('paw')
    expect(list[1].name).toHaveLength(40)
    expect(list[1].style).toEqual(DEFAULT_MOUSE)
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `f${i}`, name: `n${i}`, style: {} }))
    expect(cleanMouseFavorites(many)).toHaveLength(30)
  })
})

describe('randomMouse', () => {
  it('always makes a valid, dressed-up combo', () => {
    let seed = 7
    const random = (): number => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let i = 0; i < 300; i++) {
      const mouse = randomMouse(random)
      expect(cleanMouse(mouse)).toEqual(mouse)
      expect(MOUSE_SHAPES).toContain(mouse.shape)
      expect(mouse.trail.on).toBe(true)
      expect(mouse.trail.styles.length).toBeGreaterThanOrEqual(1)
      expect(mouse.trail.styles.length).toBeLessThanOrEqual(2)
      expect(new Set(mouse.trail.styles.map((l) => l.style)).size).toBe(mouse.trail.styles.length)
      for (const layer of mouse.trail.styles) {
        expect(TRAIL_STYLES).toContain(layer.style)
        for (const c of layer.colors) expect(c).toMatch(HEX)
      }
      for (const c of Object.values(mouse.colors)) expect(c).toMatch(HEX)
    }
  })

  it('also works at the edges of the random numbers', () => {
    expect(cleanMouse(randomMouse(() => 0))).toEqual(randomMouse(() => 0))
    const almostOne = randomMouse(() => 0.999999)
    expect(cleanMouse(almostOne)).toEqual(almostOne)
  })
})
