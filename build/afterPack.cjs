// Signs the Mac app ad-hoc (no Apple account) right after it is packed, before the
// .dmg and .zip are made. Without this the app has no sealed resources and macOS says
// it "is damaged" when it comes from the internet on Apple Silicon. With it, macOS
// shows the usual "unidentified developer" notice instead.
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const app = path.join(context.appOutDir, `${appName}.app`)
  const entitlements = path.join(__dirname, 'entitlements.mac.plist')
  const sign = (args) => {
    try {
      execFileSync('codesign', args, { stdio: 'inherit' })
    } catch (err) {
      // iCloud Drive (Desktop and Documents) tags every folder with Finder data while
      // codesign writes, so a Mac app can't be signed there.
      throw new Error(
        `Could not sign ${app}. If the project is in iCloud Drive (Desktop or Documents), ` +
          'build outside it: make "dist" a link to a local folder, e.g. ' +
          'mkdir -p ~/Library/Caches/NuggitBuild/dist && rm -rf dist && ' +
          'ln -s ~/Library/Caches/NuggitBuild/dist dist',
        { cause: err }
      )
    }
  }

  // 0. codesign refuses extended attributes ("resource fork, Finder information, or
  //    similar detritus"), which files copied from the Desktop can carry.
  execFileSync('xattr', ['-cr', app], { stdio: 'inherit' })
  // 1. Everything inside (frameworks, helpers, native modules), with their own identifiers.
  sign(['--force', '--deep', '--sign', '-', app])
  // 2. The app itself last, so its seal covers the signed insides, with Nuggit's
  //    identifier and entitlements (the microphone for Dip's call mode).
  sign([
    '--force',
    '--sign',
    '-',
    '--identifier',
    'com.nuggit.app',
    '--entitlements',
    entitlements,
    app
  ])
}
