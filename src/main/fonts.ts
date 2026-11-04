import { execFile } from 'child_process'

// Fase 13: the font families installed on this Mac, for "Fuentes de tu Mac".
// Asked once to AppKit through osascript (about 0.1 s) and kept for the session.
const SCRIPT =
  'ObjC.import("AppKit"); JSON.stringify(ObjC.deepUnwrap($.NSFontManager.sharedFontManager.availableFontFamilies))'

let cached: Promise<string[]> | null = null

export function listMacFonts(): Promise<string[]> {
  if (process.platform !== 'darwin') return Promise.resolve([])
  cached ??= new Promise<string[]>((resolve) => {
    execFile(
      '/usr/bin/osascript',
      ['-l', 'JavaScript', '-e', SCRIPT],
      { timeout: 10_000 },
      (err, stdout) => {
        if (err) return resolve([])
        try {
          const list: unknown = JSON.parse(stdout)
          const names = Array.isArray(list)
            ? list.filter((f): f is string => typeof f === 'string')
            : []
          // Hidden system families start with a dot (".SF NS"): not meant to be picked.
          resolve(
            [...new Set(names.filter((f) => f && !f.startsWith('.')))].sort((a, b) =>
              a.localeCompare(b)
            )
          )
        } catch {
          resolve([])
        }
      }
    )
  }).then((list) => {
    if (list.length === 0) cached = null // try again next time
    return list
  })
  return cached
}
