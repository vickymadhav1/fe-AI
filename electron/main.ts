import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  powerSaveBlocker,
  screen,
  session,
  systemPreferences,
  Tray,
} from 'electron'
import { createServer, type Server } from 'node:http'
import { execFile } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import path from 'node:path'
import { stealthBridge, type StealthResult } from './stealth/stealth-bridge.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDevelopment = process.argv.includes('--dev')
const desktopPort = 47831
const execFileAsync = promisify(execFile)
let staticServer: Server | null = null
let mainWindow: BrowserWindow | null = null
let floatingWindow: BrowserWindow | null = null
let latestResult: FloatingResult | null = null
let powerSaveBlockerId: number | null = null
let isQuitting = false
let invisibleProtectionEnabled = false
let stealthProtectionEnabled = false
let stealthShortcut = 'Alt+Space'
let tray: Tray | null = null
let latestStealthResult: StealthResult | null = null

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
  screenshotPreviewUrl?: string
}

interface ActiveMeetingWindow {
  activeMeetingApp: string
  activeWindowTitle: string
}

interface CompanionWindowState {
  x?: number
  y?: number
  width: number
  height: number
  alwaysOnTop: boolean
  transparency: number
}

const internalSourcePattern = /interview mate(?: ai)?/i
const meetingAppPatterns: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Microsoft Teams', pattern: /microsoft teams|teams/i },
  { name: 'Zoom', pattern: /\bzoom\b|zoom meeting/i },
  { name: 'Google Meet', pattern: /google meet|meet\.google|meet -/i },
  { name: 'Cisco Webex', pattern: /webex|cisco webex/i },
  { name: 'Slack Huddles', pattern: /slack|huddle/i },
  { name: 'Discord', pattern: /discord/i },
  { name: 'Skype', pattern: /skype/i },
]
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

const detectMeetingApp = (value: string): string => {
  return meetingAppPatterns.find(({ pattern }) => pattern.test(value))?.name ?? ''
}

const detectMacActiveWindow = async (): Promise<ActiveMeetingWindow | null> => {
  const script = [
    'tell application "System Events"',
    'set frontApp to name of first application process whose frontmost is true',
    'set windowTitle to ""',
    'try',
    'set windowTitle to name of front window of first application process whose frontmost is true',
    'end try',
    'return frontApp & "\n" & windowTitle',
    'end tell',
  ].join('\n')

  const { stdout } = await execFileAsync('osascript', ['-e', script])
  const [appName = '', windowTitle = ''] = stdout.trim().split('\n')
  const activeWindowTitle = windowTitle || appName

  return {
    activeMeetingApp: detectMeetingApp(`${appName} ${activeWindowTitle}`),
    activeWindowTitle,
  }
}

const detectCaptureMeetingWindow = async (): Promise<ActiveMeetingWindow> => {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 0, height: 0 },
  })
  const meetingSource = sources.find((source) => detectMeetingApp(source.name))

  return {
    activeMeetingApp: meetingSource ? detectMeetingApp(meetingSource.name) : '',
    activeWindowTitle: meetingSource?.name ?? '',
  }
}

const detectActiveMeetingWindow = async (): Promise<ActiveMeetingWindow> => {
  try {
    if (process.platform === 'darwin') {
      const detected = await detectMacActiveWindow()
      if (detected) return detected
    }
  } catch (error) {
    console.warn('[Interview] Active window detection failed', error)
  }

  return detectCaptureMeetingWindow()
}

const applyCaptureProtection = () => {
  const enabled = invisibleProtectionEnabled || stealthProtectionEnabled
  mainWindow?.setContentProtection(enabled)
  floatingWindow?.setContentProtection(enabled)
}

const applyInvisibleProtection = () => {
  applyCaptureProtection()
}

const setStealthCaptureProtection = async (enabled: boolean) => {
  stealthProtectionEnabled = enabled
  latestStealthResult = enabled
    ? stealthBridge.enable(mainWindow, floatingWindow, { reducePresence: true })
    : stealthBridge.disable(mainWindow, floatingWindow)
  if (!enabled && invisibleProtectionEnabled) applyCaptureProtection()

  const activeWindow = await detectActiveMeetingWindow().catch(() => ({
    activeMeetingApp: '',
    activeWindowTitle: '',
  }))
  const payload = {
    ...latestStealthResult,
    enabled: stealthProtectionEnabled,
    supported: latestStealthResult.captureExclusion,
    activeMeetingApp: activeWindow.activeMeetingApp,
    activeWindowTitle: activeWindow.activeWindowTitle,
  }

  console.info(`[Stealth] Platform: ${payload.platformName}`)
  console.info(`[Stealth] Meeting: ${payload.activeMeetingApp || 'Not detected'}`)
  console.info(
    enabled
      ? '[Stealth] Capture Protection Active'
      : '[Stealth] Capture Protection Disabled',
  )
  if (enabled) {
    console.info('[Stealth] Viewer Visibility Protection Applied')
  }

  return payload
}

const restoreStealthWindows = () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
  if (floatingWindow) {
    floatingWindow.show()
  }
  console.info('[Stealth] Windows Focused')
}

const registerStealthShortcut = (accelerator = stealthShortcut) => {
  if (!accelerator.trim()) return { registered: false, accelerator: stealthShortcut }
  if (stealthShortcut && globalShortcut.isRegistered(stealthShortcut)) {
    globalShortcut.unregister(stealthShortcut)
  }
  stealthShortcut = accelerator.trim()
  const registered = globalShortcut.register(stealthShortcut, restoreStealthWindows)
  if (!registered) {
    console.warn('[Stealth] Shortcut registration failed', { accelerator: stealthShortcut })
  }
  return { registered, accelerator: stealthShortcut }
}

const createStealthTray = () => {
  if (tray) return tray
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVR4AWP4//8/AyUYTFhYGJgYGBj+QzEMDExASmBqGBoYGBgAAE79AhE6D9nBAAAAAElFTkSuQmCC',
  )
  tray = new Tray(icon)
  tray.setToolTip('Interview Mate AI')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Restore Interview Mate AI', click: restoreStealthWindows },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]))
  tray.on('click', restoreStealthWindows)
  return tray
}

const cachePath = () => path.join(app.getPath('userData'), 'latest-result.json')
const companionStatePath = () => path.join(app.getPath('userData'), 'companion-window-state.json')
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

const defaultCompanionState = (): CompanionWindowState => {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width } = display.workArea
  return {
    x: x + Math.max(20, width - 1040),
    y: y + 20,
    width: 1000,
    height: 420,
    alwaysOnTop: true,
    transparency: 0.92,
  }
}

const readCompanionState = async (): Promise<CompanionWindowState> => {
  try {
    const saved = JSON.parse(await readFile(companionStatePath(), 'utf8')) as Partial<CompanionWindowState>
    const fallback = defaultCompanionState()
    return {
      ...fallback,
      ...saved,
      width: Math.max(700, Math.min(1400, Number(saved.width ?? fallback.width))),
      height: Math.max(320, Math.min(900, Number(saved.height ?? fallback.height))),
      alwaysOnTop: saved.alwaysOnTop ?? fallback.alwaysOnTop,
      transparency: Math.max(0.45, Math.min(1, Number(saved.transparency ?? fallback.transparency))),
    }
  } catch {
    return defaultCompanionState()
  }
}

const persistCompanionState = async () => {
  if (!floatingWindow || floatingWindow.isDestroyed()) return
  const bounds = floatingWindow.getBounds()
  const state: CompanionWindowState = {
    ...bounds,
    alwaysOnTop: floatingWindow.isAlwaysOnTop(),
    transparency: floatingWindow.getOpacity(),
  }
  await writeFile(companionStatePath(), JSON.stringify(state), 'utf8')
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

const createFloatingWindow = async () => {
  const state = await readCompanionState()
  floatingWindow = new BrowserWindow({
    title: 'Interview Mate AI Companion',
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 700,
    minHeight: 320,
    maxWidth: 1400,
    maxHeight: 900,
    alwaysOnTop: state.alwaysOnTop,
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
  floatingWindow.setAlwaysOnTop(state.alwaysOnTop, 'floating')
  floatingWindow.setOpacity(state.transparency)
  applyCaptureProtection()
  void floatingWindow.loadURL(rendererUrl('/companion'))
  floatingWindow.webContents.once('did-finish-load', () => {
    if (latestResult) {
      floatingWindow?.webContents.send('floating:result', latestResult)
    }
  })
  floatingWindow.on('closed', () => {
    floatingWindow = null
  })
  floatingWindow.on('resize', () => void persistCompanionState())
  floatingWindow.on('move', () => void persistCompanionState())
  floatingWindow.on('always-on-top-changed', () => void persistCompanionState())

  return floatingWindow
}

const startCompanion = async () => {
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
    screenshotPreviewUrl:''
  }
  if (!floatingWindow) {
    const window = await createFloatingWindow()
    window.webContents.once('did-finish-load', () => {
      window.show()
    window.focus()
    })
    return
  }
  floatingWindow.webContents.send('floating:result', latestResult ?? emptyResult)
  floatingWindow.show()
  floatingWindow.focus()
}

const stopCompanion = () => {
  void persistCompanionState()
  floatingWindow?.close()
  floatingWindow = null
}

const getCompanionWindowState = () => {
  if (!floatingWindow || floatingWindow.isDestroyed()) return null
  return {
    ...floatingWindow.getBounds(),
    alwaysOnTop: floatingWindow.isAlwaysOnTop(),
    transparency: floatingWindow.getOpacity(),
  }
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
  applyCaptureProtection()

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
  createStealthTray()
  registerStealthShortcut(stealthShortcut)

  ipcMain.handle('floating:get-latest', () => latestResult)
  ipcMain.handle('meeting:get-active-window', detectActiveMeetingWindow)
  ipcMain.handle('stealth:restore-windows', () => {
    restoreStealthWindows()
    const capabilities = stealthBridge.currentPlatformCapabilities()
    return {
      hidden: false,
      protected: stealthProtectionEnabled,
      enabled: stealthProtectionEnabled,
      supported: capabilities.captureExclusion,
      ...capabilities,
      platform: process.platform,
    }
  })
  ipcMain.handle('stealth:set-capture-protection', async (_event, enabled: boolean) =>
    setStealthCaptureProtection(enabled),
  )
  ipcMain.handle('stealth:register-shortcut', (_event, accelerator: string) =>
    registerStealthShortcut(accelerator),
  )
  ipcMain.handle('stealth:get-state', () => {
    const capabilities = stealthBridge.currentPlatformCapabilities()
    return {
      ...capabilities,
      ...(latestStealthResult ?? {}),
      hidden: false,
      protected: stealthProtectionEnabled,
      enabled: stealthProtectionEnabled,
      supported: capabilities.captureExclusion,
      shortcut: stealthShortcut,
    }
  })
  ipcMain.handle('invisible:set-content-protection', (_event, enabled: boolean) => {
    invisibleProtectionEnabled = enabled
    applyInvisibleProtection()
    const capabilities = stealthBridge.currentPlatformCapabilities()
    console.info(
      enabled
        ? '[Invisible] Content Protection Applied'
        : '[Invisible] Content Protection Removed',
    )
    return {
      enabled: invisibleProtectionEnabled,
      supported: capabilities.captureExclusion,
      platform: process.platform,
      platformName: capabilities.platformName,
      warning: capabilities.warning,
    }
  })
  ipcMain.handle('invisible:get-content-protection', () => {
    const capabilities = stealthBridge.currentPlatformCapabilities()
    return {
      enabled: invisibleProtectionEnabled,
      supported: capabilities.captureExclusion,
      platform: process.platform,
      platformName: capabilities.platformName,
      warning: capabilities.warning,
    }
  })
 ipcMain.handle('capture:list-sources', async () => {
  console.log('capture:list-sources CALLED')

  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 360, height: 220 },
    fetchWindowIcons: true,
  })

  console.log('SOURCE COUNT', sources.length)

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
    console.info('[CompanionSync] IPC publish received', {
      question: result.question,
      answerLength: result.answer?.length ?? 0,
      hasCompanionWindow: Boolean(floatingWindow && !floatingWindow.isDestroyed()),
    })
    void persistLatestResult()
    floatingWindow?.webContents.send('floating:result', result)
    console.info('[CompanionSync] IPC update forwarded')
  })
  ipcMain.on('companion:start', () => void startCompanion())
  ipcMain.on('companion:end', stopCompanion)
  ipcMain.handle('companion:get-window-state', getCompanionWindowState)
  ipcMain.handle('companion:set-always-on-top', (_event, enabled: boolean) => {
    floatingWindow?.setAlwaysOnTop(enabled, 'floating')
    void persistCompanionState()
    return getCompanionWindowState()
  })
  ipcMain.handle('companion:set-transparency', (_event, value: number) => {
    const opacity = Math.max(0.45, Math.min(1, Number(value)))
    floatingWindow?.setOpacity(opacity)
    void persistCompanionState()
    return getCompanionWindowState()
  })
  ipcMain.on('floating:copy-code', () => {
    if (latestResult?.code) clipboard.writeText(latestResult.code)
  })

  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (latestResult?.code) clipboard.writeText(latestResult.code)
  })
  app.on('activate', () => {
    if (!mainWindow) createWindow()
    restoreStealthWindows()
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
