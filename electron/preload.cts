const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')
const { randomUUID } = require('node:crypto') as typeof import('node:crypto')

let logContext: { sessionId?: string; lifecycleId?: string } = {}
const correlation = () => ({
  __interviewMateIpc: true as const,
  correlationId: `ipc_${Date.now().toString(36)}_${randomUUID()}`,
  ...logContext,
})
const invoke = (channel: string, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, correlation(), ...args)
const send = (channel: string, ...args: unknown[]) =>
  ipcRenderer.send(channel, correlation(), ...args)

contextBridge.exposeInMainWorld('interviewMateDesktop', {
  isElectron: true,
  platform: process.platform,
  logging: {
    setContext: (context: { sessionId?: string; lifecycleId?: string }) => {
      logContext = {
        ...(typeof context.sessionId === 'string' ? { sessionId: context.sessionId } : {}),
        ...(typeof context.lifecycleId === 'string' ? { lifecycleId: context.lifecycleId } : {}),
      }
    },
  },
  capture: {
    listSources: () => invoke('capture:list-sources'),
    saveDebug: (bytes: Uint8Array, width: number, height: number) =>
      invoke('capture:save-debug', bytes, width, height),
    getVisibleScreen: () => invoke('capture:get-visible-screen'),
  },
  meeting: {
    getActiveWindow: () => invoke('meeting:get-active-window'),
  },
  invisible: {
    setContentProtection: (enabled: boolean) =>
      invoke('invisible:set-content-protection', enabled),
    getContentProtection: () => invoke('invisible:get-content-protection'),
  },
  stealth: {
    restoreWindows: () => invoke('stealth:restore-windows'),
    setCaptureProtection: (enabled: boolean) =>
      invoke('stealth:set-capture-protection', enabled),
    registerShortcut: (accelerator: string) =>
      invoke('stealth:register-shortcut', accelerator),
    getState: () => invoke('stealth:get-state'),
  },
  floating: {
    getLatest: () => invoke('floating:get-latest'),
    publish: (result: unknown) => send('floating:publish', result),
    start: () => send('companion:start'),
    end: () => send('companion:end'),
    minimize: () => send('companion:minimize'),
    requestShutdown: () => invoke('companion:request-shutdown'),
    getWindowState: () => invoke('companion:get-window-state'),
    setAlwaysOnTop: (enabled: boolean) => invoke('companion:set-always-on-top', enabled),
    setTransparency: (value: number) => invoke('companion:set-transparency', value),
    copyCode: () => send('floating:copy-code'),
    onResult: (callback: (result: unknown) => void) => {
      const listener = (_event: unknown, result: unknown) => callback(result)
      ipcRenderer.on('floating:result', listener)
      return () => ipcRenderer.removeListener('floating:result', listener)
    },
    onShutdownRequested: (callback: () => void | Promise<void>) => {
      const listener = async () => {
        await callback()
        send('companion:shutdown-complete')
      }
      ipcRenderer.on('companion:shutdown-requested', listener)
      return () => ipcRenderer.removeListener('companion:shutdown-requested', listener)
    },
  },
})
