const fs = require('node:fs')
const path = require('node:path')
const { build, Platform } = require('electron-builder')

const outputDirectory = process.env.SMART_CALENDAR_RELEASE_DIR
  ? path.resolve(process.env.SMART_CALENDAR_RELEASE_DIR)
  : path.join(__dirname, '..', 'release')

for (const generatedDirectory of ['win-unpacked', 'win-unpacked.tmp']) {
  fs.rmSync(path.join(outputDirectory, generatedDirectory), { recursive: true, force: true })
}

build({
  targets: Platform.WINDOWS.createTarget('nsis'),
  config: {
    directories: {
      output: outputDirectory,
    },
  },
}).catch((error) => {
  console.error('Could not package the Windows desktop app:', error)
  process.exitCode = 1
})
