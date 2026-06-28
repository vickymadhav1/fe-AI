import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
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
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import path from 'node:path'
import { stealthBridge, type StealthResult } from './stealth/stealth-bridge.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDevelopment = !app.isPackaged && process.argv.includes('--dev')
let desktopPort = 47831
const execFileAsync = promisify(execFile)

if (!isDevelopment) {
  app.commandLine.appendSwitch('disable-logging')
}
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
let companionShutdownResolve: (() => void) | null = null
let companionShutdownTimer: NodeJS.Timeout | null = null

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
  interviewStartTime?: string
  elapsedSeconds?: number
  formattedDuration?: string
  remainingSeconds?: number
  remainingMinutes?: number
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

type IpcSender = 'main' | 'companion'
type IpcFailureCode =
  | 'FORBIDDEN_SENDER'
  | 'INVALID_PAYLOAD'
  | 'IPC_HANDLER_FAILED'

interface IpcFailure {
  success: false
  code: IpcFailureCode
  message: string
}

class IpcSecurityError extends Error {
  constructor(
    readonly code: IpcFailureCode,
    message: string,
  ) {
    super(message)
  }
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
    staticServer?.listen(0, '127.0.0.1', () => {
      const address = staticServer?.address() as AddressInfo | null
      desktopPort = address?.port ?? desktopPort
      resolve()
    })
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
      devTools: isDevelopment,
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

const minimizeCompanion = () => {
  void persistCompanionState()
  floatingWindow?.minimize()
}

const completeCompanionShutdown = () => {
  if (companionShutdownTimer) {
    clearTimeout(companionShutdownTimer)
    companionShutdownTimer = null
  }
  companionShutdownResolve?.()
  companionShutdownResolve = null
  stopCompanion()
}

const requestInterviewShutdown = () =>
  new Promise<void>((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      stopCompanion()
      resolve()
      return
    }

    companionShutdownResolve = resolve
    if (companionShutdownTimer) clearTimeout(companionShutdownTimer)
    companionShutdownTimer = setTimeout(() => {
      console.warn('[Companion] shutdown completion timed out')
      companionShutdownResolve = null
      companionShutdownTimer = null
      resolve()
    }, 20_000)

    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('companion:shutdown-requested')
  })

const getCompanionWindowState = () => {
  if (!floatingWindow || floatingWindow.isDestroyed()) return null
  return {
    ...floatingWindow.getBounds(),
    alwaysOnTop: floatingWindow.isAlwaysOnTop(),
    transparency: floatingWindow.getOpacity(),
  }
}

const ipcFailure = (code: IpcFailureCode, message: string): IpcFailure => ({
  success: false,
  code,
  message,
})

const toIpcFailure = (error: unknown): IpcFailure => {
  if (error instanceof IpcSecurityError) return ipcFailure(error.code, error.message)
  return ipcFailure('IPC_HANDLER_FAILED', 'The IPC request could not be completed.')
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const assertNoArgs = (args: unknown[]) => {
  if (args.length > 0) {
    throw new IpcSecurityError('INVALID_PAYLOAD', 'This IPC channel does not accept arguments.')
  }
}

const assertBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new IpcSecurityError('INVALID_PAYLOAD', `${fieldName} must be a boolean.`)
  }
  return value
}

const assertFiniteNumber = (
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new IpcSecurityError('INVALID_PAYLOAD', `${fieldName} must be a finite number.`)
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new IpcSecurityError('INVALID_PAYLOAD', `${fieldName} must be an integer.`)
  }
  if (options.min !== undefined && value < options.min) {
    throw new IpcSecurityError('INVALID_PAYLOAD', `${fieldName} is below the allowed minimum.`)
  }
  if (options.max !== undefined && value > options.max) {
    throw new IpcSecurityError('INVALID_PAYLOAD', `${fieldName} exceeds the allowed maximum.`)
  }
  return value
}

const assertShortcut = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new IpcSecurityError('INVALID_PAYLOAD', 'accelerator must be a string.')
  }
  const accelerator = value.trim()
  if (!accelerator || accelerator.length > 80) {
    throw new IpcSecurityError('INVALID_PAYLOAD', 'accelerator must be a non-empty shortcut string.')
  }
  return accelerator
}

const assertBytes = (value: unknown): Uint8Array => {
  if (!(value instanceof Uint8Array)) {
    throw new IpcSecurityError('INVALID_PAYLOAD', 'bytes must be a Uint8Array.')
  }
  if (value.byteLength === 0 || value.byteLength > 50 * 1024 * 1024) {
    throw new IpcSecurityError('INVALID_PAYLOAD', 'bytes must contain a valid screenshot payload.')
  }
  return value
}

const assertAllowedSender = (
  event: IpcMainEvent | IpcMainInvokeEvent,
  allowedSenders: IpcSender[],
) => {
  const sender = event.sender
  const isMainSender = Boolean(mainWindow && !mainWindow.isDestroyed() && sender === mainWindow.webContents)
  const isCompanionSender = Boolean(
    floatingWindow && !floatingWindow.isDestroyed() && sender === floatingWindow.webContents,
  )

  if (
    (allowedSenders.includes('main') && isMainSender) ||
    (allowedSenders.includes('companion') && isCompanionSender)
  ) {
    return
  }

  throw new IpcSecurityError('FORBIDDEN_SENDER', 'This renderer is not allowed to use this IPC channel.')
}

const logIpcRejection = (channel: string, failure: IpcFailure) => {
  console.warn('[IPC] rejected request', {
    channel,
    code: failure.code,
    message: failure.message,
  })
}

const safeHandle = (
  channel: string,
  allowedSenders: IpcSender[],
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>,
) => {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      assertAllowedSender(event, allowedSenders)
      return await handler(event, ...args)
    } catch (error) {
      const failure = toIpcFailure(error)
      logIpcRejection(channel, failure)
      return failure
    }
  })
}

const safeOn = (
  channel: string,
  allowedSenders: IpcSender[],
  handler: (event: IpcMainEvent, ...args: unknown[]) => unknown | Promise<unknown>,
) => {
  ipcMain.on(channel, (event, ...args) => {
    void (async () => {
      try {
        assertAllowedSender(event, allowedSenders)
        await handler(event, ...args)
      } catch (error) {
        logIpcRejection(channel, toIpcFailure(error))
      }
    })()
  })
}

const validateFloatingResult = (value: unknown): FloatingResult => {
  if (!isRecord(value)) {
    throw new IpcSecurityError('INVALID_PAYLOAD', 'result must be an object.')
  }
  const allowedFields = new Set([
    'question',
    'answer',
    'code',
    'output',
    'language',
    'complexity',
    'confidence',
    'provider',
    'screenStatus',
    'lastCapture',
    'timestamp',
    'screenshotPreviewUrl',
    'interviewStartTime',
    'elapsedSeconds',
    'formattedDuration',
    'remainingSeconds',
    'remainingMinutes',
  ])
  const unknownField = Object.keys(value).find((key) => !allowedFields.has(key))
  if (unknownField) {
    throw new IpcSecurityError('INVALID_PAYLOAD', `Unknown result field: ${unknownField}.`)
  }

  const requiredString = (key: keyof FloatingResult): string => {
    const field = value[key]
    if (typeof field !== 'string') {
      throw new IpcSecurityError('INVALID_PAYLOAD', `${String(key)} must be a string.`)
    }
    return field
  }
  const optionalString = (key: keyof FloatingResult): string | undefined => {
    const field = value[key]
    if (field === undefined) return undefined
    if (typeof field !== 'string') {
      throw new IpcSecurityError('INVALID_PAYLOAD', `${String(key)} must be a string.`)
    }
    return field
  }
  const optionalNumber = (key: keyof FloatingResult) => {
    const field = value[key]
    if (field === undefined) return undefined
    return assertFiniteNumber(field, String(key), { min: 0 })
  }

  return {
    question: requiredString('question'),
    answer: requiredString('answer'),
    code: requiredString('code'),
    output: requiredString('output'),
    language: requiredString('language'),
    complexity: requiredString('complexity'),
    confidence: assertFiniteNumber(value.confidence, 'confidence', { min: 0, max: 1 }),
    provider: optionalString('provider'),
    screenStatus: optionalString('screenStatus'),
    lastCapture: optionalString('lastCapture'),
    timestamp: requiredString('timestamp'),
    screenshotPreviewUrl: optionalString('screenshotPreviewUrl'),
    interviewStartTime: optionalString('interviewStartTime'),
    elapsedSeconds: optionalNumber('elapsedSeconds'),
    formattedDuration: optionalString('formattedDuration'),
    remainingSeconds: optionalNumber('remainingSeconds'),
    remainingMinutes: optionalNumber('remainingMinutes'),
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
      devTools: isDevelopment,
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

  safeHandle('floating:get-latest', ['main', 'companion'], (_event, ...args) => {
    assertNoArgs(args)
    return latestResult
  })
  safeHandle('meeting:get-active-window', ['main'], (_event, ...args) => {
    assertNoArgs(args)
    return detectActiveMeetingWindow()
  })
  safeHandle('stealth:restore-windows', ['main'], (_event, ...args) => {
    assertNoArgs(args)
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
  safeHandle('stealth:set-capture-protection', ['main'], async (_event, enabled, ...args) => {
    assertNoArgs(args)
    return setStealthCaptureProtection(assertBoolean(enabled, 'enabled'))
  })
  safeHandle('stealth:register-shortcut', ['main'], (_event, accelerator, ...args) => {
    assertNoArgs(args)
    return registerStealthShortcut(assertShortcut(accelerator))
  })
  safeHandle('stealth:get-state', ['main'], (_event, ...args) => {
    assertNoArgs(args)
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
  safeHandle('invisible:set-content-protection', ['main'], (_event, enabled, ...args) => {
    assertNoArgs(args)
    invisibleProtectionEnabled = assertBoolean(enabled, 'enabled')
    applyInvisibleProtection()
    const capabilities = stealthBridge.currentPlatformCapabilities()
    console.info(
      invisibleProtectionEnabled
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
  safeHandle('invisible:get-content-protection', ['main'], (_event, ...args) => {
    assertNoArgs(args)
    const capabilities = stealthBridge.currentPlatformCapabilities()
    return {
      enabled: invisibleProtectionEnabled,
      supported: capabilities.captureExclusion,
      platform: process.platform,
      platformName: capabilities.platformName,
      warning: capabilities.warning,
    }
  })
  safeHandle('capture:list-sources', ['main'], async (_event, ...args) => {
    assertNoArgs(args)
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
  safeHandle(
    'capture:save-debug',
    ['main'],
    async (_event, bytes, width, height, ...args) => {
      assertNoArgs(args)
      const validBytes = assertBytes(bytes)
      const validWidth = assertFiniteNumber(width, 'width', { min: 1, max: 10000, integer: true })
      const validHeight = assertFiniteNumber(height, 'height', { min: 1, max: 10000, integer: true })
      const filePath = debugCapturePath()
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, Buffer.from(validBytes))
      console.info('[ScreenCapture] screenshot captured')
      console.info(`[ScreenCapture] dimensions ${validWidth}x${validHeight}`)
      return filePath
    },
  )
  safeHandle('capture:get-visible-screen', ['main'], async (_event, ...args) => {
    assertNoArgs(args)
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
  safeOn('floating:publish', ['main'], (_event, result, ...args) => {
    assertNoArgs(args)
    latestResult = validateFloatingResult(result)
    console.info('[CompanionSync] IPC publish received', {
      question: latestResult.question,
      answerLength: latestResult.answer?.length ?? 0,
      hasCompanionWindow: Boolean(floatingWindow && !floatingWindow.isDestroyed()),
    })
    void persistLatestResult()
    floatingWindow?.webContents.send('floating:result', latestResult)
    console.info('[CompanionSync] IPC update forwarded')
  })
  safeOn('companion:start', ['main'], (_event, ...args) => {
    assertNoArgs(args)
    void startCompanion()
  })
  safeOn('companion:end', ['main', 'companion'], (event, ...args) => {
    assertNoArgs(args)
    if (floatingWindow && event.sender === floatingWindow.webContents) {
      void requestInterviewShutdown()
      return
    }
    stopCompanion()
  })
  safeOn('companion:minimize', ['main', 'companion'], (_event, ...args) => {
    assertNoArgs(args)
    minimizeCompanion()
  })
  safeHandle('companion:request-shutdown', ['companion'], (_event, ...args) => {
    assertNoArgs(args)
    return requestInterviewShutdown()
  })
  safeOn('companion:shutdown-complete', ['main'], (_event, ...args) => {
    assertNoArgs(args)
    completeCompanionShutdown()
  })
  safeHandle('companion:get-window-state', ['main', 'companion'], (_event, ...args) => {
    assertNoArgs(args)
    return getCompanionWindowState()
  })
  safeHandle('companion:set-always-on-top', ['main', 'companion'], (_event, enabled, ...args) => {
    assertNoArgs(args)
    floatingWindow?.setAlwaysOnTop(assertBoolean(enabled, 'enabled'), 'floating')
    void persistCompanionState()
    return getCompanionWindowState()
  })
  safeHandle('companion:set-transparency', ['main', 'companion'], (_event, value, ...args) => {
    assertNoArgs(args)
    const opacity = assertFiniteNumber(value, 'value', { min: 0.45, max: 1 })
    floatingWindow?.setOpacity(opacity)
    void persistCompanionState()
    return getCompanionWindowState()
  })
  safeOn('floating:copy-code', ['companion'], (_event, ...args) => {
    assertNoArgs(args)
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
