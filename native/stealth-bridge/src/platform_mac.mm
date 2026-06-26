#import <AppKit/AppKit.h>
#include "platform.h"

namespace {

NSApplicationActivationPolicy previousPolicy = NSApplicationActivationPolicyRegular;
bool previousPolicyCaptured = false;

NSWindow* WindowFromHandle(void* handle) {
  if (!handle) return nil;
  NSView* view = (__bridge NSView*)handle;
  return [view window];
}

void ProtectWindow(void* handle, bool companion) {
  NSWindow* window = WindowFromHandle(handle);
  if (!window) return;

  NSLog(@"[Native] Applying NSWindow sharingType");
  [window setSharingType:NSWindowSharingNone];

  if (companion) {
    [window setLevel:NSFloatingWindowLevel];
    [window setCollectionBehavior:
      NSWindowCollectionBehaviorCanJoinAllSpaces |
      NSWindowCollectionBehaviorFullScreenAuxiliary |
      NSWindowCollectionBehaviorTransient];
  }
}

void RestoreWindow(void* handle, bool companion) {
  NSWindow* window = WindowFromHandle(handle);
  if (!window) return;

  [window setSharingType:NSWindowSharingReadOnly];
  if (companion) {
    [window setLevel:NSFloatingWindowLevel];
    [window setCollectionBehavior:
      NSWindowCollectionBehaviorCanJoinAllSpaces |
      NSWindowCollectionBehaviorFullScreenAuxiliary];
  }
}

}  // namespace

NativeStealthCapabilities GetNativeStealthCapabilities() {
  return {
    true,
    true,
    true,
    false,
    "macOS",
    "macOS native sharing protection is applied; ScreenCaptureKit-based meeting apps may still vary."
  };
}

NativeStealthResult EnableNativeStealth(void* mainHandle, void* companionHandle, bool reducePresence) {
  @autoreleasepool {
    ProtectWindow(mainHandle, false);
    ProtectWindow(companionHandle, true);

    bool dockHidden = false;
    if (reducePresence) {
      NSLog(@"[Native] Applying activation policy");
      if (!previousPolicyCaptured) {
        previousPolicy = [NSApp activationPolicy];
        previousPolicyCaptured = true;
      }
      dockHidden = [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    }

    NSLog(@"[Native] Protection active");
    return {
      true,
      true,
      true,
      dockHidden,
      false,
      "macOS NSWindow sharingType and activation policy applied."
    };
  }
}

NativeStealthResult DisableNativeStealth(void* mainHandle, void* companionHandle) {
  @autoreleasepool {
    RestoreWindow(mainHandle, false);
    RestoreWindow(companionHandle, true);

    if (previousPolicyCaptured) {
      [NSApp setActivationPolicy:previousPolicy];
      previousPolicyCaptured = false;
    }

    return {
      true,
      false,
      false,
      false,
      false,
      "macOS native stealth protection disabled."
    };
  }
}

