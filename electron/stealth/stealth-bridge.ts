import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

export interface StealthCapabilities {
  nativeProtection: boolean
  captureExclusion: boolean
  dockHiding: boolean
  taskbarHiding: boolean
  platform: string
  platformName: string
  warning: string
  nativeBridgeLoaded: boolean
}

export interface StealthResult extends StealthCapabilities {
  enabled: boolean
  mainWindowProtected: boolean
  companionWindowProtected: boolean
  dockHidden: boolean
  taskbarHidden: boolean
  activeMeetingApp?: string
  activeWindowTitle?: string
}

interface NativeStealthAddon {
  capabilities(): {
    nativeProtection: boolean
    captureExclusion: boolean
    dockHiding: boolean
    taskbarHiding: boolean
    platform: string
    warning: string
  }
  enable(
    mainHandle: Buffer | null,
    companionHandle: Buffer | null,
    reducePresence: boolean,
  ): {
    ok: boolean
    nativeProtection: boolean
    captureExclusion: boolean
    dockHidden: boolean
    taskbarHidden: boolean
    warning: string
  }
  disable(
    mainHandle: Buffer | null,
    companionHandle: Buffer | null,
  ): {
    ok: boolean
    nativeProtection: boolean
    captureExclusion: boolean
    dockHidden: boolean
    taskbarHidden: boolean
    warning: string
  }
}

const platformName = () => {
  if (process.platform === 'darwin') return 'macOS'
  if (process.platform === 'win32') return 'Windows'
  if (process.platform === 'linux') return 'Linux'
  return process.platform
}

const fallbackWarning = () => {
  if (process.platform === 'linux') {
    return 'Linux has no universal native capture-exclusion API across X11, Wayland, PipeWire portals, and compositors.'
  }
  return 'Native stealth bridge addon is not loaded. Electron content protection fallback is active.'
}

const nativeAddonPaths = () => [
  path.join(app.getAppPath(), 'native/stealth-bridge/build/Release/stealth_bridge.node'),
  path.resolve(__dirname, '../../native/stealth-bridge/build/Release/stealth_bridge.node'),
  path.resolve(__dirname, '../native/stealth-bridge/build/Release/stealth_bridge.node'),
]

const loadNativeAddon = (): NativeStealthAddon | null => {
  for (const candidate of nativeAddonPaths()) {
    try {
      return require(candidate) as NativeStealthAddon
    } catch {
      // Try the next deployment/build location.
    }
  }
  return null
}

export class StealthBridge {
  private readonly nativeAddon = loadNativeAddon()
  private taskbarHidden = false

  currentPlatformCapabilities(): StealthCapabilities {
    const nativeCapabilities = this.nativeAddon?.capabilities()
    return {
      nativeProtection: nativeCapabilities?.nativeProtection ?? false,
      captureExclusion: nativeCapabilities?.captureExclusion ?? false,
      dockHiding: nativeCapabilities?.dockHiding ?? false,
      taskbarHiding: nativeCapabilities?.taskbarHiding ?? process.platform === 'win32',
      platform: process.platform,
      platformName: nativeCapabilities?.platform ?? platformName(),
      warning: nativeCapabilities?.warning ?? fallbackWarning(),
      nativeBridgeLoaded: Boolean(this.nativeAddon),
    }
  }

  supportsNativeProtection() {
    return this.currentPlatformCapabilities().nativeProtection
  }

  supportsDockHiding() {
    return this.currentPlatformCapabilities().dockHiding
  }

  supportsCaptureExclusion() {
    return this.currentPlatformCapabilities().captureExclusion
  }

  enable(
    mainWindow: BrowserWindow | null,
    companionWindow: BrowserWindow | null,
    options: { reducePresence?: boolean } = {},
  ): StealthResult {
    const reducePresence = options.reducePresence ?? true
    const capabilities = this.currentPlatformCapabilities()
    const nativeResult = this.nativeAddon?.enable(
      mainWindow?.getNativeWindowHandle() ?? null,
      companionWindow?.getNativeWindowHandle() ?? null,
      reducePresence,
    )

    mainWindow?.setContentProtection(true)
    companionWindow?.setContentProtection(true)

    if (reducePresence && process.platform === 'win32') {
      mainWindow?.setSkipTaskbar(true)
      companionWindow?.setSkipTaskbar(true)
      this.taskbarHidden = true
    }

    console.info('[Stealth] Native bridge initialized', {
      loaded: capabilities.nativeBridgeLoaded,
      platform: capabilities.platformName,
    })
    console.info('[Stealth] Native capture exclusion enabled')
    console.info('[Stealth] Main window protected')
    console.info('[Stealth] Companion protected')

    return {
      ...capabilities,
      enabled: true,
      nativeProtection: nativeResult?.nativeProtection ?? capabilities.nativeProtection,
      captureExclusion: nativeResult?.captureExclusion ?? capabilities.captureExclusion,
      mainWindowProtected: Boolean(mainWindow),
      companionWindowProtected: Boolean(companionWindow),
      dockHidden: nativeResult?.dockHidden ?? false,
      taskbarHidden: nativeResult?.taskbarHidden ?? this.taskbarHidden,
      warning: nativeResult?.warning || capabilities.warning,
    }
  }

  disable(mainWindow: BrowserWindow | null, companionWindow: BrowserWindow | null): StealthResult {
    const capabilities = this.currentPlatformCapabilities()
    const nativeResult = this.nativeAddon?.disable(
      mainWindow?.getNativeWindowHandle() ?? null,
      companionWindow?.getNativeWindowHandle() ?? null,
    )

    if (this.taskbarHidden) {
      mainWindow?.setSkipTaskbar(false)
      companionWindow?.setSkipTaskbar(false)
      this.taskbarHidden = false
    }

    return {
      ...capabilities,
      enabled: false,
      nativeProtection: nativeResult?.nativeProtection ?? false,
      captureExclusion: nativeResult?.captureExclusion ?? false,
      mainWindowProtected: false,
      companionWindowProtected: false,
      dockHidden: false,
      taskbarHidden: false,
      warning: nativeResult?.warning || capabilities.warning,
    }
  }
}

export const stealthBridge = new StealthBridge()

