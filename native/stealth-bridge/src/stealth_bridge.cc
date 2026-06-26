#include <node_api.h>
#include <cstring>
#include "platform.h"

namespace {

void ThrowIfFailed(napi_env env, napi_status status) {
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Native stealth bridge Node-API call failed");
  }
}

void* BufferToPointer(napi_env env, napi_value value) {
  bool isBuffer = false;
  ThrowIfFailed(env, napi_is_buffer(env, value, &isBuffer));
  if (!isBuffer) return nullptr;

  void* data = nullptr;
  size_t length = 0;
  ThrowIfFailed(env, napi_get_buffer_info(env, value, &data, &length));
  if (!data || length < sizeof(void*)) return nullptr;

  void* pointer = nullptr;
  std::memcpy(&pointer, data, sizeof(void*));
  return pointer;
}

napi_value CreateBoolean(napi_env env, bool value) {
  napi_value result;
  ThrowIfFailed(env, napi_get_boolean(env, value, &result));
  return result;
}

napi_value CreateString(napi_env env, const char* value) {
  napi_value result;
  ThrowIfFailed(env, napi_create_string_utf8(env, value ? value : "", NAPI_AUTO_LENGTH, &result));
  return result;
}

void SetProperty(napi_env env, napi_value object, const char* key, napi_value value) {
  napi_value name;
  ThrowIfFailed(env, napi_create_string_utf8(env, key, NAPI_AUTO_LENGTH, &name));
  ThrowIfFailed(env, napi_set_property(env, object, name, value));
}

napi_value Capabilities(napi_env env, napi_callback_info info) {
  NativeStealthCapabilities capabilities = GetNativeStealthCapabilities();

  napi_value result;
  ThrowIfFailed(env, napi_create_object(env, &result));
  SetProperty(env, result, "nativeProtection", CreateBoolean(env, capabilities.nativeProtection));
  SetProperty(env, result, "captureExclusion", CreateBoolean(env, capabilities.captureExclusion));
  SetProperty(env, result, "dockHiding", CreateBoolean(env, capabilities.dockHiding));
  SetProperty(env, result, "taskbarHiding", CreateBoolean(env, capabilities.taskbarHiding));
  SetProperty(env, result, "platform", CreateString(env, capabilities.platform));
  SetProperty(env, result, "warning", CreateString(env, capabilities.warning));
  return result;
}

napi_value ResultToObject(napi_env env, const NativeStealthResult& nativeResult) {
  napi_value result;
  ThrowIfFailed(env, napi_create_object(env, &result));
  SetProperty(env, result, "ok", CreateBoolean(env, nativeResult.ok));
  SetProperty(env, result, "nativeProtection", CreateBoolean(env, nativeResult.nativeProtection));
  SetProperty(env, result, "captureExclusion", CreateBoolean(env, nativeResult.captureExclusion));
  SetProperty(env, result, "dockHidden", CreateBoolean(env, nativeResult.dockHidden));
  SetProperty(env, result, "taskbarHidden", CreateBoolean(env, nativeResult.taskbarHidden));
  SetProperty(env, result, "warning", CreateString(env, nativeResult.warning.c_str()));
  return result;
}

napi_value Enable(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value args[3];
  ThrowIfFailed(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr));

  void* mainHandle = argc >= 1 ? BufferToPointer(env, args[0]) : nullptr;
  void* companionHandle = argc >= 2 ? BufferToPointer(env, args[1]) : nullptr;
  bool reducePresence = false;
  if (argc >= 3) {
    ThrowIfFailed(env, napi_get_value_bool(env, args[2], &reducePresence));
  }

  return ResultToObject(env, EnableNativeStealth(mainHandle, companionHandle, reducePresence));
}

napi_value Disable(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  ThrowIfFailed(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr));

  void* mainHandle = argc >= 1 ? BufferToPointer(env, args[0]) : nullptr;
  void* companionHandle = argc >= 2 ? BufferToPointer(env, args[1]) : nullptr;

  return ResultToObject(env, DisableNativeStealth(mainHandle, companionHandle));
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value capabilities;
  napi_value enable;
  napi_value disable;

  ThrowIfFailed(env, napi_create_function(env, "capabilities", NAPI_AUTO_LENGTH, Capabilities, nullptr, &capabilities));
  ThrowIfFailed(env, napi_create_function(env, "enable", NAPI_AUTO_LENGTH, Enable, nullptr, &enable));
  ThrowIfFailed(env, napi_create_function(env, "disable", NAPI_AUTO_LENGTH, Disable, nullptr, &disable));

  SetProperty(env, exports, "capabilities", capabilities);
  SetProperty(env, exports, "enable", enable);
  SetProperty(env, exports, "disable", disable);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)

