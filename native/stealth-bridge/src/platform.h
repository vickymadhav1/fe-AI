#pragma once

#include <node_api.h>
#include <string>

struct NativeStealthCapabilities {
  bool nativeProtection = false;
  bool captureExclusion = false;
  bool dockHiding = false;
  bool taskbarHiding = false;
  const char* platform = "unknown";
  const char* warning = "";
};

struct NativeStealthResult {
  bool ok = false;
  bool nativeProtection = false;
  bool captureExclusion = false;
  bool dockHidden = false;
  bool taskbarHidden = false;
  std::string warning;
};

NativeStealthCapabilities GetNativeStealthCapabilities();
NativeStealthResult EnableNativeStealth(void* mainHandle, void* companionHandle, bool reducePresence);
NativeStealthResult DisableNativeStealth(void* mainHandle, void* companionHandle);

