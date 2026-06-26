#include "platform.h"

NativeStealthCapabilities GetNativeStealthCapabilities() {
  return {
    false,
    false,
    false,
    false,
    "Linux",
    "Linux has no universal native capture-exclusion API across X11, Wayland, PipeWire portals, and compositors."
  };
}

NativeStealthResult EnableNativeStealth(void* mainHandle, void* companionHandle, bool reducePresence) {
  (void)mainHandle;
  (void)companionHandle;
  (void)reducePresence;
  return {
    false,
    false,
    false,
    false,
    false,
    "Native stealth capture exclusion is unavailable on this Linux environment."
  };
}

NativeStealthResult DisableNativeStealth(void* mainHandle, void* companionHandle) {
  (void)mainHandle;
  (void)companionHandle;
  return {
    true,
    false,
    false,
    false,
    false,
    "Linux fallback state restored."
  };
}

