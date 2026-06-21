"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('interviewMateDesktop', {
    isElectron: true,
    platform: process.platform,
    capture: {
        saveDebug: (bytes, width, height) => ipcRenderer.invoke('capture:save-debug', bytes, width, height),
        getVisibleScreen: () => ipcRenderer.invoke('capture:get-visible-screen'),
    },
    floating: {
        getLatest: () => ipcRenderer.invoke('floating:get-latest'),
        publish: (result) => ipcRenderer.send('floating:publish', result),
        start: () => ipcRenderer.send('companion:start'),
        end: () => ipcRenderer.send('companion:end'),
        copyCode: () => ipcRenderer.send('floating:copy-code'),
        onResult: (callback) => {
            const listener = (_event, result) => callback(result);
            ipcRenderer.on('floating:result', listener);
            return () => ipcRenderer.removeListener('floating:result', listener);
        },
    },
});
//# sourceMappingURL=preload.cjs.map