#include <windows.h>
#include <dwmapi.h>

#ifndef WDA_EXCLUDEFROMCAPTURE
#define WDA_EXCLUDEFROMCAPTURE 0x00000011
#endif

static const wchar_t CLASS_NAME[] = L"InterviewMateStealthProbe";

LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
    switch (message) {
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    case WM_PAINT: {
        PAINTSTRUCT ps;
        HDC hdc = BeginPaint(hwnd, &ps);
        RECT rect;
        GetClientRect(hwnd, &rect);
        HBRUSH brush = CreateSolidBrush(RGB(10, 16, 32));
        FillRect(hdc, &rect, brush);
        DeleteObject(brush);
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, RGB(248, 250, 252));
        DrawTextW(
            hdc,
            L"Visible locally. Attempting WDA_EXCLUDEFROMCAPTURE.",
            -1,
            &rect,
            DT_CENTER | DT_VCENTER | DT_SINGLELINE
        );
        EndPaint(hwnd, &ps);
        return 0;
    }
    default:
        return DefWindowProcW(hwnd, message, wParam, lParam);
    }
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
    WNDCLASSW wc = {};
    wc.lpfnWndProc = WindowProc;
    wc.hInstance = instance;
    wc.lpszClassName = CLASS_NAME;
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    RegisterClassW(&wc);

    HWND hwnd = CreateWindowExW(
        WS_EX_TOPMOST | WS_EX_LAYERED,
        CLASS_NAME,
        L"Interview Mate AI Native Stealth Probe",
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        640,
        320,
        nullptr,
        nullptr,
        instance,
        nullptr
    );

    if (!hwnd) return 1;

    SetLayeredWindowAttributes(hwnd, 0, 235, LWA_ALPHA);

    BOOL protectedWindow = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
    if (!protectedWindow) {
        MessageBoxW(
            hwnd,
            L"SetWindowDisplayAffinity failed. Windows 10 2004+ and DWM composition are required.",
            L"Stealth Probe",
            MB_ICONWARNING
        );
    }

    ShowWindow(hwnd, showCommand);

    MSG message = {};
    while (GetMessageW(&message, nullptr, 0, 0)) {
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }

    return 0;
}

