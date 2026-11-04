import { describe, expect, it } from 'vitest'
import { isNewer, parseVersion } from './updates'

describe('updates', () => {
  it('reads versions and tags', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3])
    expect(parseVersion('1.2')).toEqual([1, 2, 0])
    expect(parseVersion('2.0.0-beta.1')).toEqual([2, 0, 0])
    expect(parseVersion('Recordatorios')).toBeNull()
  })

  it('only says newer when it really is', () => {
    expect(isNewer('v1.1.0', '1.0.0')).toBe(true)
    expect(isNewer('1.10.0', '1.9.0')).toBe(true)
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('0.9.9', '1.0.0')).toBe(false)
    expect(isNewer('nightly', '1.0.0')).toBe(false)
  })
})
