"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { contextBridge, ipcRenderer } = require('electron');
const { randomUUID } = require('node:crypto');
let logContext = {};
const correlation = () => ({
    __interviewMateIpc: true,
    correlationId: `ipc_${Date.now().toString(36)}_${randomUUID()}`,
    ...logContext,
});
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, correlation(), ...args);
const send = (channel, ...args) => ipcRenderer.send(channel, correlation(), ...args);
contextBridge.exposeInMainWorld('interviewMateDesktop', {
    isElectron: true,
    platform: process.platform,
    logging: {
        setContext: (context) => {
            logContext = {
                ...(typeof context.sessionId === 'string' ? { sessionId: context.sessionId } : {}),
                ...(typeof context.lifecycleId === 'string' ? { lifecycleId: context.lifecycleId } : {}),
            };
        },
    },
    capture: {
        listSources: () => invoke('capture:list-sources'),
        saveDebug: (bytes, width, height) => invoke('capture:save-debug', bytes, width, height),
        getVisibleScreen: () => invoke('capture:get-visible-screen'),
    },
    meeting: {
        getActiveWindow: () => invoke('meeting:get-active-window'),
    },
    invisible: {
        setContentProtection: (enabled) => invoke('invisible:set-content-protection', enabled),
        getContentProtection: () => invoke('invisible:get-content-protection'),
    },
    stealth: {
        restoreWindows: () => invoke('stealth:restore-windows'),
        setCaptureProtection: (enabled) => invoke('stealth:set-capture-protection', enabled),
        registerShortcut: (accelerator) => invoke('stealth:register-shortcut', accelerator),
        getState: () => invoke('stealth:get-state'),
    },
    floating: {
        getLatest: () => invoke('floating:get-latest'),
        publish: (result) => send('floating:publish', result),
        start: () => send('companion:start'),
        end: () => send('companion:end'),
        minimize: () => send('companion:minimize'),
        requestShutdown: () => invoke('companion:request-shutdown'),
        getWindowState: () => invoke('companion:get-window-state'),
        setAlwaysOnTop: (enabled) => invoke('companion:set-always-on-top', enabled),
        setTransparency: (value) => invoke('companion:set-transparency', value),
        copyCode: () => send('floating:copy-code'),
        onResult: (callback) => {
            const listener = (_event, result) => callback(result);
            ipcRenderer.on('floating:result', listener);
            return () => ipcRenderer.removeListener('floating:result', listener);
        },
        onShutdownRequested: (callback) => {
            const listener = async () => {
                await callback();
                send('companion:shutdown-complete');
            };
            ipcRenderer.on('companion:shutdown-requested', listener);
            return () => ipcRenderer.removeListener('companion:shutdown-requested', listener);
        },
    },
});
