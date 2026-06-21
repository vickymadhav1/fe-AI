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
  floating: {
    getLatest: () => ipcRenderer.invoke('floating:get-latest'),
    publish: (result: unknown) => ipcRenderer.send('floating:publish', result),
    start: () => ipcRenderer.send('companion:start'),
    end: () => ipcRenderer.send('companion:end'),
    copyCode: () => ipcRenderer.send('floating:copy-code'),
    onResult: (callback: (result: unknown) => void) => {
      const listener = (_event: unknown, result: unknown) => callback(result)
      ipcRenderer.on('floating:result', listener)
      return () => ipcRenderer.removeListener('floating:result', listener)
    },
  },
})
