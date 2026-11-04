import { describe, expect, it } from 'vitest'
import type { MouseStyle } from '../../../shared/types'
import { MOUSE_SHAPES } from '../../../shared/types'
import { defaultMouse } from '../../../shared/mouse'
import {
  CURSOR_KINDS,
  contrast,
  cursorCss,
  cursorHotspot,
  cursorSvg,
  cursorVars,
  outlineFor
} from './mouseCursor'
import { layerCap, MAX_PARTICLES } from './mouseTrail'

const dressed = (over: Partial<MouseStyle> = {}): MouseStyle => ({
  ...defaultMouse(),
  shape: 'arrow',
  colors: { fill: '#8b5cf6', border: '#ffffff', details: '#facc15' },
  ...over
})

describe('cursorSvg / cursorCss', () => {
  it('gives nothing for the system cursor', () => {
    expect(cursorCss(defaultMouse())).toBeNull()
    expect(cursorVars(defaultMouse())).toEqual({})
  })

  it('draws every shape at the chosen size, never over 128 px', () => {
    for (const shape of MOUSE_SHAPES) {
      for (const [size, px] of [
        ['small', 24],
        ['medium', 32],
        ['large', 48]
      ] as const) {
        for (const kind of CURSOR_KINDS) {
          const svg = cursorSvg(dressed({ shape, size }), kind)
          expect(svg).toContain(`width="${px}" height="${px}"`)
          expect(px).toBeLessThanOrEqual(128)
          const [x, y] = cursorHotspot(dressed({ shape, size }), kind)
          expect(x).toBeGreaterThanOrEqual(0)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThan(px)
          expect(y).toBeLessThan(px)
        }
      }
    }
  })

  it('puts the hotspot on the tip of arrows and in the middle of a star', () => {
    expect(cursorHotspot(dressed({ shape: 'arrow', size: 'medium' }))).toEqual([4, 2])
    expect(cursorHotspot(dressed({ shape: 'arrow', size: 'large' }))).toEqual([6, 3])
    expect(cursorHotspot(dressed({ shape: 'pencil', size: 'medium' }))).toEqual([3, 29])
    expect(cursorHotspot(dressed({ shape: 'plane', size: 'small' }))).toEqual([2, 2])
    expect(cursorHotspot(dressed({ shape: 'star', size: 'medium' }))).toEqual([16, 17])
    expect(cursorHotspot(dressed({ shape: 'arrow' }), 'text')).toEqual([16, 16])
  })

  it('writes a CSS cursor with a data URL, the hotspot and a fallback', () => {
    const css = cursorCss(dressed({ size: 'large' }), 'pointer')!
    expect(css).toMatch(/^url\("data:image\/svg\+xml,[^"]+"\) 6 3, pointer$/)
    expect(cursorCss(dressed(), 'text')).toMatch(/\) 16 16, text$/)
    expect(cursorCss(dressed(), 'resize')).toMatch(/, nwse-resize$/)
    expect(Object.keys(cursorVars(dressed()))).toEqual([
      '--cur-default',
      '--cur-pointer',
      '--cur-text',
      '--cur-grab',
      '--cur-grabbing',
      '--cur-resize'
    ])
  })

  it('uses the chosen colors, the gradient and the details only where they exist', () => {
    const paw = cursorSvg(
      dressed({
        shape: 'paw',
        colors: { fill: '#ffffff', fill2: '#ec4899', border: '#111111', details: '#f9a8d4' }
      })
    )
    expect(paw).toContain('linearGradient')
    expect(paw).toContain('#f9a8d4')
    const star = cursorSvg(
      dressed({ shape: 'star', colors: { fill: '#ef4444', border: '#111111', details: '#00ff00' } })
    )
    expect(star).toContain('#ef4444')
    expect(star).not.toContain('#00ff00')
    // The "click" cursor is the same shape plus a dot of the details color.
    const pointer = cursorSvg(
      dressed({
        shape: 'star',
        colors: { fill: '#ef4444', border: '#111111', details: '#00ff00' }
      }),
      'pointer'
    )
    expect(pointer).toContain('#00ff00')
  })
})

describe('outlineFor (always visible)', () => {
  it('needs no outline when the border stands out', () => {
    expect(
      outlineFor({ fill: '#8b5cf6', border: '#ffffff', details: '#000000' }, '#141a33')
    ).toBeNull()
    expect(
      outlineFor({ fill: '#facc15', border: '#111111', details: '#000000' }, '#f6f4fd')
    ).toBeNull()
  })

  it('adds one when fill and border are alike', () => {
    expect(outlineFor({ fill: '#ffffff', border: '#fefefe', details: '#000000' }, '#141a33')).toBe(
      '#111111'
    )
  })

  it('adds one when the border melts into the background', () => {
    expect(outlineFor({ fill: '#ef4444', border: '#ffffff', details: '#000000' }, '#f6f4fd')).toBe(
      '#111111'
    )
    expect(outlineFor({ fill: '#facc15', border: '#141a33', details: '#000000' }, '#141a33')).toBe(
      '#ffffff'
    )
  })

  it('draws the outline into the SVG', () => {
    const svg = cursorSvg(
      dressed({ colors: { fill: '#ffffff', border: '#ffffff', details: '#000000' } }),
      'default',
      '#ffffff'
    )
    expect(svg).toContain('stroke="#111111"')
  })

  it('measures contrast like WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#777777')).toBe(1)
  })
})

describe('trail budget', () => {
  it('never lets the styles together go over the pool', () => {
    for (let length = 1; length <= 10; length++) {
      expect(layerCap(length, 2) * 2).toBeLessThanOrEqual(MAX_PARTICLES)
      expect(layerCap(length, 1)).toBeLessThanOrEqual(MAX_PARTICLES)
      expect(layerCap(length, 1)).toBeGreaterThan(layerCap(length - 1 || 1, 1) - 1)
    }
  })
})
