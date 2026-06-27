#include <windows.h>
#include "platform.h"

#ifndef WDA_EXCLUDEFROMCAPTURE
#define WDA_EXCLUDEFROMCAPTURE 0x00000011
#endif

namespace {

bool ApplyAffinity(void* handle, DWORD affinity) {
  if (!handle) return false;
  HWND hwnd = reinterpret_cast<HWND>(handle);
  return SetWindowDisplayAffinity(hwnd, affinity) == TRUE;
}

}  // namespace

NativeStealthCapabilities GetNativeStealthCapabilities() {
  return {
    true,
    true,
    false,
    true,
    "Windows",
    "Windows WDA_EXCLUDEFROMCAPTURE is supported on Windows 10 version 2004 and later."
  };
}

NativeStealthResult EnableNativeStealth(void* mainHandle, void* companionHandle, bool reducePresence) {
  OutputDebugStringW(L"[Native] Applying display affinity\n");
  const bool mainOk = ApplyAffinity(mainHandle, WDA_EXCLUDEFROMCAPTURE);
  const bool companionOk = ApplyAffinity(companionHandle, WDA_EXCLUDEFROMCAPTURE);

  OutputDebugStringW(L"[Native] Protection active\n");
  return {
    mainOk || companionOk,
    mainOk || companionOk,
    mainOk || companionOk,
    false,
    reducePresence,
    mainOk && companionOk
      ? "Windows display affinity applied to all windows."
      : "Windows display affinity could not be applied to every window."
  };
}

NativeStealthResult DisableNativeStealth(void* mainHandle, void* companionHandle) {
  ApplyAffinity(mainHandle, WDA_NONE);
  ApplyAffinity(companionHandle, WDA_NONE);
  return {
    true,
    false,
    false,
    false,
    false,
    "Windows native stealth protection disabled."
  };
}

