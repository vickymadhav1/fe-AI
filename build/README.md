# Interview Mate AI Desktop Packaging

This directory contains Electron Builder resources.

## Required Release Assets

- `icon-master.png`: 1024x1024 RGBA master icon regenerated from the provided Interview Mate AI brand image.
- `icon.png`: 1024x1024 Linux/Electron PNG icon.
- `icon.ico`: Multi-resolution Windows ICO containing 16, 24, 32, 48, 64, 128, and 256 px PNG entries.
- `icon.icns`: macOS application/DMG icon generated from `icon.iconset/`.
- `icon.iconset/`: Complete macOS iconset containing 16, 32, 128, 256, 512, and 1024 px retina variants.
- `png/`: Optimized PNG exports at 16, 24, 32, 48, 64, 128, 256, 512, and 1024 px.
- `entitlements.mac.plist`: macOS hardened-runtime entitlements for Electron, screen capture, audio capture, and native bridge loading.

## Signing Placeholders

Windows signing is configured through Electron Builder environment variables:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

macOS signing and notarization require:

- Apple Developer ID Application certificate
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Auto-update is intentionally not enabled yet. `publish` is set to `null` in `package.json`.
