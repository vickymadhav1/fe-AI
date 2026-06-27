# Native Stealth Overlay Proofs

These files are the archived technical-spike probes that informed the production
bridge in `native/stealth-bridge/src`. They do not participate in the application build.

## macOS

`macos/StealthOverlayProbe.swift` creates a visible local floating window and applies `NSWindow.sharingType = .none`.

Build locally on macOS:

```bash
swiftc macos/StealthOverlayProbe.swift -o /tmp/StealthOverlayProbe
/tmp/StealthOverlayProbe
```

Then test with Google Meet, Teams, Zoom, and Webex from a second viewer machine.

## Windows

`windows/stealth_affinity_probe.cpp` creates a visible local Win32 window and applies `SetWindowDisplayAffinity(..., WDA_EXCLUDEFROMCAPTURE)`.

Build with MSVC Developer Command Prompt:

```bat
cl /EHsc windows\stealth_affinity_probe.cpp user32.lib gdi32.lib dwmapi.lib
stealth_affinity_probe.exe
```

Then test with Teams, Zoom, Meet in Chrome, and Webex.

## Production Outcome

The validated behavior is implemented by the adjacent Node-API addon, which accepts
native Electron window handles and applies the matching platform adapter.
