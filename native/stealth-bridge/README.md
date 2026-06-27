# Native Stealth Bridge

Production native bridge for Interview Mate AI Stealth Mode.

## Architecture

```text
Vue/Electron renderer
  -> Electron main process
  -> electron/stealth/stealth-bridge.ts
  -> native/stealth-bridge Node-API addon
  -> platform adapter
```

## Build

```bash
npm run build:native-stealth
```

The Electron app still runs if the addon is not built. In that case, `StealthBridge` reports `nativeBridgeLoaded: false` and falls back to Electron content protection with an explicit warning.

The architecture report and original platform probes are colocated under `docs/`
and `spikes/` for historical context. They are not part of the production build.

## Platform Behavior

macOS:

- Applies `NSWindow.sharingType = .none`
- Applies floating level and collection behaviors to the companion window
- Optionally applies accessory activation policy during Stealth Mode

Windows:

- Applies `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`
- Electron integration also reduces taskbar presence during active Stealth Mode

Linux:

- Reports unsupported native capture exclusion
- Uses Electron fallback only where available
