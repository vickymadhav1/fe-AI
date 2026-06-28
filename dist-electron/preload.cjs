"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('interviewMateDesktop', {
    isElectron: true,
    platform: process.platform,
    capture: {
        listSources: () => ipcRenderer.invoke('capture:list-sources'),
        saveDebug: (bytes, width, height) => ipcRenderer.invoke('capture:save-debug', bytes, width, height),
        getVisibleScreen: () => ipcRenderer.invoke('capture:get-visible-screen'),
    },
    meeting: {
        getActiveWindow: () => ipcRenderer.invoke('meeting:get-active-window'),
    },
    invisible: {
        setContentProtection: (enabled) => ipcRenderer.invoke('invisible:set-content-protection', enabled),
        getContentProtection: () => ipcRenderer.invoke('invisible:get-content-protection'),
    },
    stealth: {
        restoreWindows: () => ipcRenderer.invoke('stealth:restore-windows'),
        setCaptureProtection: (enabled) => ipcRenderer.invoke('stealth:set-capture-protection', enabled),
        registerShortcut: (accelerator) => ipcRenderer.invoke('stealth:register-shortcut', accelerator),
        getState: () => ipcRenderer.invoke('stealth:get-state'),
    },
    floating: {
        getLatest: () => ipcRenderer.invoke('floating:get-latest'),
        publish: (result) => ipcRenderer.send('floating:publish', result),
        start: () => ipcRenderer.send('companion:start'),
        end: () => ipcRenderer.send('companion:end'),
        minimize: () => ipcRenderer.send('companion:minimize'),
        requestShutdown: () => ipcRenderer.invoke('companion:request-shutdown'),
        getWindowState: () => ipcRenderer.invoke('companion:get-window-state'),
        setAlwaysOnTop: (enabled) => ipcRenderer.invoke('companion:set-always-on-top', enabled),
        setTransparency: (value) => ipcRenderer.invoke('companion:set-transparency', value),
        copyCode: () => ipcRenderer.send('floating:copy-code'),
        onResult: (callback) => {
            const listener = (_event, result) => callback(result);
            ipcRenderer.on('floating:result', listener);
            return () => ipcRenderer.removeListener('floating:result', listener);
        },
        onShutdownRequested: (callback) => {
            const listener = async () => {
                await callback();
                ipcRenderer.send('companion:shutdown-complete');
            };
            ipcRenderer.on('companion:shutdown-requested', listener);
            return () => ipcRenderer.removeListener('companion:shutdown-requested', listener);
        },
    },
});
