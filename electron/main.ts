import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  powerSaveBlocker,
  screen,
  session,
  systemPreferences,
} from 'electron'
import { createServer, type Server } from 'node:http'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDevelopment = process.argv.includes('--dev')
const desktopPort = 47831
let staticServer: Server | null = null
let mainWindow: BrowserWindow | null = null
let floatingWindow: BrowserWindow | null = null
let latestResult: FloatingResult | null = null
let powerSaveBlockerId: number | null = null
let isQuitting = false

interface FloatingResult {
  question: string
  answer: string
  code: string
  output: string
  language: string
  complexity: string
  confidence: number
  provider?: string
  screenStatus?: string
  lastCapture?: string
  timestamp: string
}

const internalSourcePattern = /interview mate(?: ai)?/i
const sourcePreference = [
  /^entire screen$/i,
  /^screen\s*\d*/i,
  /chrome/i,
  /visual studio code|vs code/i,
  /cursor/i,
  /stackblitz/i,
  /leetcode/i,
  /hackerrank/i,
]

const sourceRank = (name: string) => {
  const index = sourcePreference.findIndex((pattern) => pattern.test(name))
  return index === -1 ? sourcePreference.length : index
}

const cachePath = () => path.join(app.getPath('userData'), 'latest-result.json')
const debugCapturePath = () =>
  isDevelopment
    ? path.resolve(__dirname, '../debug/latest-capture.png')
    : path.join(app.getPath('userData'), 'debug/latest-capture.png')

const readLatestResult = async () => {
  try {
    latestResult = JSON.parse(await readFile(cachePath(), 'utf8')) as FloatingResult
  } catch {
    latestResult = null
  }
}

const persistLatestResult = async () => {
  if (!latestResult) return
  await writeFile(cachePath(), JSON.stringify(latestResult), 'utf8')
}

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const startStaticServer = async (): Promise<void> => {
  const distDirectory = path.resolve(__dirname, '../dist')

  staticServer = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
      const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
      let filePath = path.resolve(distDirectory, relativePath)

      if (!filePath.startsWith(`${distDirectory}${path.sep}`)) {
        response.writeHead(403).end('Forbidden')
        return
      }

      const fileStats = await stat(filePath).catch(() => null)

      // Vue Router history routes are served by index.html.
      if (!fileStats?.isFile()) {
        filePath = path.join(distDirectory, 'index.html')
      }

      const body = await readFile(filePath)
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      response.end(body)
    } catch {
      response.writeHead(500).end('Desktop application failed to load')
    }
  })

  await new Promise<void>((resolve, reject) => {
    staticServer?.once('error', reject)
    staticServer?.listen(desktopPort, '127.0.0.1', resolve)
  })
}

const rendererUrl = (route = '') =>
  isDevelopment
    ? `http://localhost:5173${route}`
    : `http://localhost:${desktopPort}${route}`

const createFloatingWindow = () => {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width } = display.workArea
  floatingWindow = new BrowserWindow({
    title: 'Interview Mate AI Companion',
    x: x + width - 470,
    y: y + 20,
    width: 450,
    height: 600,
    minWidth: 360,
    minHeight: 420,
    maxWidth: 900,
    maxHeight: 1000,
    alwaysOnTop: true,
    focusable: true,
    movable: true,
    transparent: true,
    frame: false,
    resizable: true,
    skipTaskbar: false,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  floatingWindow.setAlwaysOnTop(true, 'floating')
  void floatingWindow.loadURL(rendererUrl('/companion'))
  floatingWindow.webContents.once('did-finish-load', () => {
    if (latestResult) {
      floatingWindow?.webContents.send('floating:result', latestResult)
    }
  })
  floatingWindow.on('closed', () => {
    floatingWindow = null
  })

  return floatingWindow
}

const startCompanion = () => {
  latestResult = null
  const emptyResult: FloatingResult = {
    question: '',
    answer: '',
    code: '',
    output: '',
    language: '',
    complexity: '',
    confidence: 0,
    provider: '',
    screenStatus: 'No Screen Data',
    lastCapture: '',
    timestamp: new Date().toISOString(),
  }
  if (!floatingWindow) {
    const window = createFloatingWindow()
    window.webContents.once('did-finish-load', () => {
      window.show()
      window.focus()
    })
    return
  }
  floatingWindow.webContents.send('floating:result', emptyResult)
  floatingWindow.show()
  floatingWindow.focus()
}

const stopCompanion = () => {
  // The companion is intentionally persistent. Interview controls stop capture,
  // but they should not hide or minimize the always-on-top answer window.
}

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#f8fafc',
    title: 'Interview Mate AI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  mainWindow = window

  if (isDevelopment) {
    void window.loadURL(rendererUrl())
  } else {
    void window.loadURL(rendererUrl())
  }
  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })
}

app.whenReady().then(async () => {
  if (!isDevelopment) {
    await startStaticServer()
  }
  await readLatestResult()
  powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension')

  // Electron resolves getDisplayMedia through this handler and includes loopback audio
  // when the operating system supports system-audio capture.
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
      })
      const source = sources
        .filter((item) => !internalSourcePattern.test(item.name))
        .sort((a, b) => sourceRank(a.name) - sourceRank(b.name))[0]

      callback({
        video: source,
        audio: process.platform === 'win32' ? 'loopback' : undefined,
      })
    },
    { useSystemPicker: true },
  )

  createWindow()

  ipcMain.handle('floating:get-latest', () => latestResult)
  ipcMain.handle('capture:list-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 360, height: 220 },
      fetchWindowIcons: true,
    })

    return sources
      .filter((source) => !internalSourcePattern.test(source.name))
      .sort((a, b) => sourceRank(a.name) - sourceRank(b.name))
      .map((source) => ({
        id: source.id,
        name: source.name,
        displayId: source.display_id,
        thumbnailDataUrl: source.thumbnail.isEmpty() ? '' : source.thumbnail.toDataURL(),
      }))
  })
  ipcMain.handle(
    'capture:save-debug',
    async (_event, bytes: Uint8Array, width: number, height: number) => {
      const filePath = debugCapturePath()
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, Buffer.from(bytes))
      console.info('[ScreenCapture] screenshot captured')
      console.info(`[ScreenCapture] dimensions ${width}x${height}`)
      return filePath
    },
  )
  ipcMain.handle('capture:get-visible-screen', async () => {
    if (
      process.platform === 'darwin' &&
      systemPreferences.getMediaAccessStatus('screen') !== 'granted'
    ) {
      return { available: false, reason: 'permission-required' }
    }

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.min(2560, Math.round(display.size.width * display.scaleFactor)),
        height: Math.min(1600, Math.round(display.size.height * display.scaleFactor)),
      },
    })
    const source =
      sources.find((item) => item.display_id === String(display.id)) ?? sources[0]
    if (!source || source.thumbnail.isEmpty()) {
      return { available: false, reason: 'capture-unavailable' }
    }

    const image = source.thumbnail.toPNG()
    const size = source.thumbnail.getSize()
    const filePath = debugCapturePath()
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, image)
    console.info('[ScreenIntelligence] visible screen captured')
    console.info(`[ScreenIntelligence] dimensions ${size.width}x${size.height}`)

    return {
      available: true,
      bytes: image,
      width: size.width,
      height: size.height,
      capturedAt: new Date().toISOString(),
      debugPath: filePath,
      sourceName: source.name,
    }
  })
  ipcMain.on('floating:publish', (_event, result: FloatingResult) => {
    latestResult = result
    void persistLatestResult()
    floatingWindow?.webContents.send('floating:result', result)
  })
  ipcMain.on('companion:start', startCompanion)
  ipcMain.on('companion:end', stopCompanion)
  ipcMain.on('floating:copy-code', () => {
    if (latestResult?.code) clipboard.writeText(latestResult.code)
  })

  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (latestResult?.code) clipboard.writeText(latestResult.code)
  })
  app.on('activate', () => {
    if (!mainWindow) createWindow()
    mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    staticServer?.close()
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  globalShortcut.unregisterAll()
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId)
  }
  staticServer?.close()
})
