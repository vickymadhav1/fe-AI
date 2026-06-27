# Native Overlay Architecture Spike: True Stealth Mode

Date: 2026-06-26

## Executive Summary

Interview Mate AI can improve viewer-invisible UI behavior with native capture-protection APIs, but no single public API can guarantee invisibility across every operating system, browser, meeting application, and share mode.

The best maintainable architecture is:

```text
Existing Electron app
  -> Native stealth bridge
  -> Platform window protection adapter
  -> Existing main and companion BrowserWindow handles
```

Do not replace OCR, AI, Socket.IO, screen capture, audio, or interview workflow. The native layer should only manage window capture policy, Dock/taskbar policy, and capability reporting.

## Current Application Baseline

The app currently uses Electron `40.8.0`.

Current relevant implementation:

- `BrowserWindow.setContentProtection(enabled)` is applied to the main window and companion window.
- The app has a transparent always-on-top companion window.
- Stealth Mode has already been corrected so it no longer hides local windows.
- The remaining architecture gap is stronger native capture-exclusion and honest compatibility reporting.

## Electron Capabilities

Electron exposes `BrowserWindow.setContentProtection(enable)`.

Electron documents this as preventing window contents from being captured by other apps. On macOS it maps to `NSWindowSharingNone`; on Windows it calls `SetWindowDisplayAffinity` with `WDA_EXCLUDEFROMCAPTURE`.

Electron also supports:

- Transparent frameless windows.
- Always-on-top windows.
- Skip taskbar behavior via `setSkipTaskbar`.
- macOS activation policy through `app.setActivationPolicy`.
- Desktop capture through `desktopCapturer` and Chromium capture APIs.

## Electron Limitations

Electron alone cannot guarantee true viewer invisibility in all screen-sharing contexts.

Known limitations:

- `setContentProtection` protects the window content, not necessarily Dock/taskbar presence.
- Entire-screen sharing behavior depends on OS capture stack and meeting app implementation.
- Browser tab sharing cannot be influenced by native window APIs because it captures browser content, not desktop windows.
- Application-window sharing may still list the Electron app unless taskbar/Dock/app activation policy is adjusted.
- Electron has no cross-platform API for compositor-level Linux capture exclusion.
- Electron does not expose every native macOS `NSWindow` or Windows HWND policy knob directly.

## macOS Native Capabilities

Relevant native APIs:

- `NSWindow.sharingType = .none`
- `NSWindow.level`
- `NSWindow.collectionBehavior`
- `NSApplication.setActivationPolicy(.accessory | .regular | .prohibited)`
- ScreenCaptureKit content filtering with `SCContentFilter`
- Accessibility APIs for active app/window detection

Native Cocoa may provide more explicit control over:

- Window sharing behavior.
- App activation policy.
- Dock visibility.
- Overlay-level window behavior.

However, Apple documents that `NSWindow.sharingType` has limitations with ScreenCaptureKit. Modern meeting apps and browsers increasingly use ScreenCaptureKit, so `NSWindowSharingNone` alone is not a universal guarantee.

macOS Dock behavior:

- `NSApplicationActivationPolicyAccessory` can hide Dock/menu-bar presence while allowing UI windows.
- Switching activation policy during an interview is feasible.
- This should be treated as optional “reduced presence,” not viewer invisibility.

macOS recommendation:

- Keep Electron UI.
- Add a native macOS bridge that obtains native window handles and applies:
  - `NSWindow.sharingType = .none`
  - appropriate floating level/collection behavior for companion
  - temporary accessory activation policy during Stealth Mode
- Report “limited” if the meeting capture path is ScreenCaptureKit and cannot be verified.

## Windows Native Capabilities

Relevant native APIs:

- `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`
- `SetWindowDisplayAffinity(hwnd, WDA_MONITOR)`
- DWM window attributes
- Layered window styles
- Tool window/taskbar styles

Windows has the strongest public capture-exclusion API for this use case.

`WDA_EXCLUDEFROMCAPTURE` is intended to exclude a window from capture where supported. It requires:

- Windows 10 version 2004 or later for full exclusion behavior.
- A top-level window handle.
- Desktop Window Manager composition.

Windows taskbar behavior:

- Electron `setSkipTaskbar(true)` or native `WS_EX_TOOLWINDOW` can reduce taskbar presence.
- This can make restore/discovery harder, so a tray icon or shortcut should remain available.

Windows recommendation:

- Add a native bridge or Electron native-window-handle adapter.
- Apply `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` to both main and companion windows.
- Optionally apply skip-taskbar/tool-window only during active Stealth Mode.
- Restore normal taskbar presence after the interview.

## Linux Capabilities And Limitations

Linux does not have one universal public API equivalent to `WDA_EXCLUDEFROMCAPTURE`.

Limitations vary by:

- X11 vs Wayland.
- Desktop compositor.
- PipeWire portal implementation.
- Meeting app capture method.
- Browser version.

Some Wayland portal flows allow application/window selection controls, but an app cannot reliably mark its own windows as globally excluded from all capture.

Linux recommendation:

- Continue using Electron content protection if available.
- Report limited support.
- Do not claim true stealth.

## Browser And Meeting Limitations

### Google Meet in Chrome

Expected behavior:

- Entire desktop sharing: may honor OS-level capture exclusion on Windows; macOS depends on Chrome/ScreenCaptureKit behavior.
- Window sharing: if the user shares the meeting/browser window, the overlay should not appear unless it is inside that browser content.
- Tab sharing: native overlay windows are irrelevant and should not appear because only tab content is shared.

### Microsoft Teams Desktop

Expected behavior:

- Entire desktop sharing: Windows `WDA_EXCLUDEFROMCAPTURE` is the best available protection.
- macOS behavior depends on Teams capture implementation.
- App/window sharing may still list Interview Mate AI unless Dock/taskbar presence is reduced.

### Microsoft Teams in Chrome

Expected behavior is similar to Google Meet in Chrome.

### Zoom Desktop

Expected behavior:

- Entire desktop sharing may honor Windows capture exclusion.
- macOS depends on Zoom capture stack.
- Zoom has app-specific behavior and must be verified manually.

### Cisco Webex

Expected behavior:

- Similar to Teams/Zoom desktop.
- Capture exclusion depends on OS and Webex capture path.

## Required Manual Compatibility Matrix

This spike cannot truthfully certify remote viewer invisibility without two-machine/manual meeting tests. The implementation should include a test matrix:

| Meeting App | Platform | Share Mode | Expected | Must Verify |
| --- | --- | --- | --- | --- |
| Google Meet Chrome | macOS | Entire screen | Limited/unknown | Remote viewer does not see overlay |
| Google Meet Chrome | Windows | Entire screen | Strongest | Remote viewer does not see overlay |
| Google Meet Chrome | Any | Browser tab | Overlay should not appear | Confirm tab-only sharing |
| Teams Desktop | macOS | Entire screen | Limited/unknown | Remote viewer does not see overlay |
| Teams Desktop | Windows | Entire screen | Strongest | Remote viewer does not see overlay |
| Teams Chrome | Windows/macOS | Browser tab | Overlay should not appear | Confirm tab-only sharing |
| Zoom Desktop | macOS | Entire screen | Limited/unknown | Remote viewer does not see overlay |
| Zoom Desktop | Windows | Entire screen | Strongest | Remote viewer does not see overlay |
| Cisco Webex | Windows/macOS | Entire screen | App-dependent | Remote viewer does not see overlay |

## Native Overlay Architecture Decision

A full native overlay rewrite is not required immediately.

Recommended architecture:

```text
Electron BrowserWindow UI
  -> Native stealth Node-API addon
  -> macOS adapter
      -> NSWindow sharingType
      -> activationPolicy accessory
      -> optional collectionBehavior/window level
  -> Windows adapter
      -> SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
      -> optional taskbar/tool-window policy
  -> Linux adapter
      -> capability reporting only
```

This keeps the existing UI and interview logic intact while adding native controls only where they matter.

## Proof Of Concept Files

Standalone probes were added:

- `native/stealth-bridge/spikes/overlay/macos/StealthOverlayProbe.swift`
- `native/stealth-bridge/spikes/overlay/windows/stealth_affinity_probe.cpp`

These are intentionally isolated. They do not modify the production app.

## Recommendation

1. Keep Electron UI and current interview pipeline.
2. Create a small native stealth bridge.
3. On Windows, use `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` on both Electron windows.
4. On macOS, apply `NSWindow.sharingType = .none` and optional activation policy changes, but report limited support unless verified against the active meeting app.
5. On Linux, report limited support.
6. Add an in-app compatibility status panel:
   - Protected
   - Protection limited
   - Unsupported
   - Meeting app not verified
7. Run the manual compatibility matrix before marketing this as true invisibility.

## Conclusion

Interview Mate AI can get close to commercial stealth-assistant behavior, especially on Windows. On macOS and Linux, public APIs and meeting app capture implementations prevent a universal guarantee. The correct product behavior is to apply the strongest supported native protection, keep the local UI visible, and accurately report limitations.

## Sources

- Electron `BrowserWindow.setContentProtection`: https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable-macos-windows
- Electron `BrowserWindow.getNativeWindowHandle`: https://www.electronjs.org/docs/latest/api/browser-window#wingetnativewindowhandle
- Electron `BrowserWindow.setSkipTaskbar`: https://www.electronjs.org/docs/latest/api/browser-window#winsetskiptaskbarskip-macos-windows
- Electron `app.setActivationPolicy`: https://www.electronjs.org/docs/latest/api/app#appsetactivationpolicypolicy-macos
- Microsoft `SetWindowDisplayAffinity`: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity
- Microsoft `GetWindowDisplayAffinity`: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowdisplayaffinity
- Apple `NSWindow.sharingType`: https://developer.apple.com/documentation/appkit/nswindow/sharingtype-swift.property
- Apple `SCContentFilter`: https://developer.apple.com/documentation/screencapturekit/sccontentfilter
