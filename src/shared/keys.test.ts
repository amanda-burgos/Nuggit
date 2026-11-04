import { describe, expect, it } from 'vitest'
import { formatShortcut, withKeys } from './keys'

describe('keys', () => {
  it('shows shortcuts the Mac way', () => {
    expect(formatShortcut('CommandOrControl+1', 'mac')).toBe('⌘1')
    expect(formatShortcut('CommandOrControl+N', 'mac')).toBe('⌘N')
    expect(formatShortcut('CommandOrControl+Shift+Space', 'mac')).toBe('⌘ ⇧ Espacio')
    expect(formatShortcut('Control+Alt+Space', 'mac')).toBe('⌃ ⌥ Espacio')
  })

  it('shows shortcuts the Windows and Linux way', () => {
    expect(formatShortcut('CommandOrControl+1', 'windows')).toBe('Ctrl+1')
    expect(formatShortcut('CommandOrControl+Shift+Space', 'linux')).toBe('Ctrl+Shift+Espacio')
    expect(formatShortcut('Alt+Space', 'windows')).toBe('Alt+Espacio')
  })

  it('says things per system', () => {
    const text = 'Desde el 🧩 {mac:en la barra de menú|win:en la bandeja del sistema}.'
    expect(withKeys(text, 'mac')).toBe('Desde el 🧩 en la barra de menú.')
    expect(withKeys(text, 'linux')).toBe('Desde el 🧩 en la bandeja del sistema.')
    const three = '{mac:Arriba|win:Abajo a la derecha|linux:En la bandeja}'
    expect(withKeys(three, 'windows')).toBe('Abajo a la derecha')
    expect(withKeys(three, 'linux')).toBe('En la bandeja')
  })

  it('fills the markers in the help texts', () => {
    expect(withKeys('{mod}1 … {mod}0', 'mac')).toBe('⌘1 … ⌘0')
    expect(withKeys('{mod}1 … {mod}0', 'windows')).toBe('Ctrl+1 … Ctrl+0')
    expect(withKeys('({shift}Enter: nueva línea)', 'mac')).toBe('(⇧ Enter: nueva línea)')
    expect(withKeys('({shift}Enter: nueva línea)', 'linux')).toBe('(Shift+Enter: nueva línea)')
  })
})
