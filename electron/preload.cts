const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

contextBridge.exposeInMainWorld('interviewMateDesktop', {
  isElectron: true,
  platform: process.platform,
  capture: {
    listSources: () => ipcRenderer.invoke('capture:list-sources'),
    saveDebug: (bytes: Uint8Array, width: number, height: number) =>
      ipcRenderer.invoke('capture:save-debug', bytes, width, height),
    getVisibleScreen: () => ipcRenderer.invoke('capture:get-visible-screen'),
  },
  meeting: {
    getActiveWindow: () => ipcRenderer.invoke('meeting:get-active-window'),
  },
  invisible: {
    setContentProtection: (enabled: boolean) =>
      ipcRenderer.invoke('invisible:set-content-protection', enabled),
    getContentProtection: () => ipcRenderer.invoke('invisible:get-content-protection'),
  },
  stealth: {
    restoreWindows: () => ipcRenderer.invoke('stealth:restore-windows'),
    setCaptureProtection: (enabled: boolean) =>
      ipcRenderer.invoke('stealth:set-capture-protection', enabled),
    registerShortcut: (accelerator: string) =>
      ipcRenderer.invoke('stealth:register-shortcut', accelerator),
    getState: () => ipcRenderer.invoke('stealth:get-state'),
  },
  floating: {
    getLatest: () => ipcRenderer.invoke('floating:get-latest'),
    publish: (result: unknown) => ipcRenderer.send('floating:publish', result),
    start: () => ipcRenderer.send('companion:start'),
    end: () => ipcRenderer.send('companion:end'),
    minimize: () => ipcRenderer.send('companion:minimize'),
    requestShutdown: () => ipcRenderer.invoke('companion:request-shutdown'),
    getWindowState: () => ipcRenderer.invoke('companion:get-window-state'),
    setAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke('companion:set-always-on-top', enabled),
    setTransparency: (value: number) => ipcRenderer.invoke('companion:set-transparency', value),
    copyCode: () => ipcRenderer.send('floating:copy-code'),
    onResult: (callback: (result: unknown) => void) => {
      const listener = (_event: unknown, result: unknown) => callback(result)
      ipcRenderer.on('floating:result', listener)
      return () => ipcRenderer.removeListener('floating:result', listener)
    },
    onShutdownRequested: (callback: () => void | Promise<void>) => {
      const listener = async () => {
        await callback()
        ipcRenderer.send('companion:shutdown-complete')
      }
      ipcRenderer.on('companion:shutdown-requested', listener)
      return () => ipcRenderer.removeListener('companion:shutdown-requested', listener)
    },
  },
})
