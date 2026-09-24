#include <napi.h>
#include <windows.h>
#include <uiautomation.h>
#include <atomic>
#include <string>
#include <thread>
#include <unordered_set>
#include <vector>

static bool IsExtendedVirtualKey(WORD vk) {
    switch (vk) {
        case VK_RMENU: case VK_RCONTROL: case VK_INSERT: case VK_DELETE:
        case VK_HOME: case VK_END: case VK_PRIOR: case VK_NEXT:
        case VK_LEFT: case VK_RIGHT: case VK_UP: case VK_DOWN:
        case VK_NUMLOCK: case VK_CANCEL: case VK_SNAPSHOT:
        case VK_DIVIDE: case VK_LWIN: case VK_RWIN: case VK_APPS:
            return true;
        default:
            return false;
    }
}

Napi::Value InjectMouseMove(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    double x = info[0].As<Napi::Number>().DoubleValue();
    double y = info[1].As<Napi::Number>().DoubleValue();

    INPUT input = {0};
    input.type = INPUT_MOUSE;
    // MOUSEEVENTF_ABSOLUTE uses coordinates from 0 to 65535
    // MOUSEEVENTF_VIRTUALDESK ensures it works across multiple monitors
    input.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    input.mi.dx = (LONG)(x * 65535.0);
    input.mi.dy = (LONG)(y * 65535.0);

    SendInput(1, &input, sizeof(INPUT));
    return env.Null();
}

Napi::Value InjectMouseAction(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string button = info[0].As<Napi::String>().Utf8Value();
    std::string action = info[1].As<Napi::String>().Utf8Value();

    INPUT input = {0};
    input.type = INPUT_MOUSE;

    if (button == "left") {
        input.mi.dwFlags = (action == "down") ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
    } else if (button == "right") {
        input.mi.dwFlags = (action == "down") ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
    } else if (button == "middle") {
        input.mi.dwFlags = (action == "down") ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
    }

    SendInput(1, &input, sizeof(INPUT));
    return env.Null();
}

Napi::Value InjectMouseScroll(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    int deltaX = info[0].As<Napi::Number>().Int32Value();
    int deltaY = info[1].As<Napi::Number>().Int32Value();

    // Vertical scroll
    if (deltaY != 0) {
        INPUT input = {0};
        input.type = INPUT_MOUSE;
        input.mi.dwFlags = MOUSEEVENTF_WHEEL;
        // Windows WHEEL_DELTA is 120 per notch; browser deltaY is in pixels (3 lines ~= 100px ~= 1 notch)
        input.mi.mouseData = (DWORD)(-(deltaY * 120 / 100));
        SendInput(1, &input, sizeof(INPUT));
    }

    // Horizontal scroll
    if (deltaX != 0) {
        INPUT input = {0};
        input.type = INPUT_MOUSE;
        input.mi.dwFlags = MOUSEEVENTF_HWHEEL;
        input.mi.mouseData = (DWORD)(deltaX * 120 / 100);
        SendInput(1, &input, sizeof(INPUT));
    }

    return env.Null();
}

Napi::Value InjectKeyAction(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsString()) {
        Napi::TypeError::New(env, "Number and string expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    int vk = info[0].As<Napi::Number>().Int32Value();
    std::string action = info[1].As<Napi::String>().Utf8Value();

    INPUT input = {0};
    input.type = INPUT_KEYBOARD;
    input.ki.wVk = (WORD)vk;
    input.ki.wScan = (WORD)MapVirtualKeyW((UINT)vk, MAPVK_VK_TO_VSC);
    input.ki.dwFlags = ((action == "up") ? KEYEVENTF_KEYUP : 0) |
                       (IsExtendedVirtualKey((WORD)vk) ? KEYEVENTF_EXTENDEDKEY : 0);

    SendInput(1, &input, sizeof(INPUT));
    return env.Null();
}

Napi::Value InjectText(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::u16string text = info[0].As<Napi::String>().Utf16Value();
    std::vector<INPUT> inputs;
    inputs.reserve(text.size() * 2);
    for (char16_t c : text) {
        INPUT down = {0};
        down.type = INPUT_KEYBOARD;
        down.ki.wScan = (WORD)c;
        down.ki.dwFlags = KEYEVENTF_UNICODE;
        inputs.push_back(down);
        INPUT up = down;
        up.ki.dwFlags |= KEYEVENTF_KEYUP;
        inputs.push_back(up);
    }
    if (!inputs.empty()) SendInput((UINT)inputs.size(), inputs.data(), sizeof(INPUT));

    return env.Null();
}

// Asks UI Automation whether the control that currently owns keyboard focus is
// an editable text field. Used by the host after injecting a remote click so
// mobile viewers can pop their on-screen keyboard automatically.
//
// Heuristic (biased against false positives — a manual keyboard button exists):
//   - ControlType Edit  -> editable (covers Win32 edit boxes, browser inputs)
//   - Document/ComboBox -> editable only with a non-read-only ValuePattern
//     (Win11 Notepad, editable combos); plain web pages report no ValuePattern.
class FocusEditableWorker : public Napi::AsyncWorker {
public:
    FocusEditableWorker(Napi::Env env)
        : Napi::AsyncWorker(env), deferred(Napi::Promise::Deferred::New(env)), editable(false) {}

    Napi::Promise::Deferred deferred;
    bool editable;

    void Execute() override {
        HRESULT hrInit = CoInitializeEx(NULL, COINIT_MULTITHREADED);
        bool mustUninit = SUCCEEDED(hrInit); // S_FALSE (already inited) still pairs with CoUninitialize

        IUIAutomation* automation = nullptr;
        if (SUCCEEDED(CoCreateInstance(__uuidof(CUIAutomation), NULL, CLSCTX_INPROC_SERVER,
                                       __uuidof(IUIAutomation), (void**)&automation)) && automation) {
            IUIAutomationElement* element = nullptr;
            if (SUCCEEDED(automation->GetFocusedElement(&element)) && element) {
                CONTROLTYPEID controlType = 0;
                element->get_CurrentControlType(&controlType);

                if (controlType == UIA_EditControlTypeId) {
                    editable = true;
                } else if (controlType == UIA_DocumentControlTypeId || controlType == UIA_ComboBoxControlTypeId) {
                    IUnknown* patternUnknown = nullptr;
                    if (SUCCEEDED(element->GetCurrentPattern(UIA_ValuePatternId, &patternUnknown)) && patternUnknown) {
                        IUIAutomationValuePattern* valuePattern = nullptr;
                        if (SUCCEEDED(patternUnknown->QueryInterface(__uuidof(IUIAutomationValuePattern),
                                                                     (void**)&valuePattern)) && valuePattern) {
                            BOOL readOnly = TRUE;
                            valuePattern->get_CurrentIsReadOnly(&readOnly);
                            editable = !readOnly;
                            valuePattern->Release();
                        }
                        patternUnknown->Release();
                    }
                }
                element->Release();
            }
            automation->Release();
        }

        if (mustUninit) CoUninitialize();
    }

    void OnOK() override { deferred.Resolve(Napi::Boolean::New(Env(), editable)); }
    void OnError(const Napi::Error&) override { deferred.Resolve(Napi::Boolean::New(Env(), false)); }
};

Napi::Value FocusIsEditable(const Napi::CallbackInfo& info) {
    auto* worker = new FocusEditableWorker(info.Env());
    Napi::Promise promise = worker->deferred.Promise();
    worker->Queue();
    return promise;
}

// Toggle-key state (CapsLock / NumLock / ScrollLock): low-order bit of
// GetKeyState. Lets the host MIRROR the viewer's reported CapsLock state
// instead of blindly replaying CapsLock presses (which double-fires on
// key-repeat and drifts the two machines' states apart forever).
Napi::Value IsKeyToggled(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    int vk = 0;
    if (info.Length() > 0 && info[0].IsNumber()) vk = info[0].As<Napi::Number>().Int32Value();
    bool toggled = (GetKeyState(vk) & 0x0001) != 0;
    return Napi::Boolean::New(env, toggled);
}

// ---------------------------------------------------------------------------
// Viewer-side low-level keyboard hook ("system keys go to the remote machine").
//
// Chromium can only see the keys Windows hands it. Alt+Tab, Alt+Esc, Ctrl+Esc,
// Alt+F4, Alt+Space, PrintScreen and every Win-key combination are consumed by
// the local shell first, so a viewer pressing Win+E opened Explorer on their
// OWN laptop while the remote machine saw nothing. A WH_KEYBOARD_LL hook runs
// before the shell: while the viewer window is in the foreground (and the hook
// is enabled) those keys are swallowed locally and handed to JS instead, which
// forwards them over the session like any other keystroke.
//
// Rules that keep this from misbehaving:
//   - Only physical keys are considered (LLKHF_INJECTED is skipped), so a
//     machine that is both a host and a viewer never loops its own injection.
//   - A key-UP is swallowed if and only if its key-DOWN was swallowed, even if
//     the foreground window changed in between. Otherwise the remote machine
//     would be left with a phantom Win key held down forever.
//   - The hook thread owns the hook and pumps its own message loop; the
//     callback into JS goes through a ThreadSafeFunction.
// ---------------------------------------------------------------------------

struct HookKeyEvent {
    DWORD vk;
    DWORD scan;
    bool down;
    bool extended;
    bool alt;
    bool ctrl;
    bool shift;
};

static std::atomic<bool> g_hookEnabled{false};
static std::atomic<HWND> g_hookTarget{nullptr};
static std::atomic<bool> g_hookRunning{false};
static HHOOK g_hook = nullptr;
static DWORD g_hookThreadId = 0;
static std::thread g_hookThread;
static Napi::ThreadSafeFunction g_hookTsfn;
// Hook-thread only: keys whose DOWN we swallowed and whose UP we still owe.
static std::unordered_set<DWORD> g_swallowedDown;

static bool ForegroundIsHookTarget() {
    HWND target = g_hookTarget.load();
    if (!target) return false;
    HWND fg = GetForegroundWindow();
    if (!fg) return false;
    if (fg == target) return true;
    return GetAncestor(fg, GA_ROOT) == target;
}

// The set of keys the local shell would otherwise act on. Everything else is
// left alone so the page keeps seeing ordinary typing, chat input and the
// viewer's own local shortcuts.
static bool IsSystemKeyChord(const KBDLLHOOKSTRUCT* k) {
    const bool alt = (k->flags & LLKHF_ALTDOWN) != 0;
    const bool ctrl = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
    switch (k->vkCode) {
        case VK_LWIN:
        case VK_RWIN:
        case VK_SNAPSHOT:
            return true;
        case VK_TAB:     // Alt+Tab, Alt+Shift+Tab
        case VK_F4:      // Alt+F4
        case VK_SPACE:   // Alt+Space (window menu)
            return alt;
        case VK_ESCAPE:  // Alt+Esc, Ctrl+Esc, Ctrl+Shift+Esc
            return alt || ctrl;
        default:
            return false;
    }
}

static void CallHookCallback(Napi::Env env, Napi::Function callback, HookKeyEvent* ev) {
    if (env != nullptr && callback != nullptr) {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("vk", Napi::Number::New(env, (double)ev->vk));
        obj.Set("scan", Napi::Number::New(env, (double)ev->scan));
        obj.Set("down", Napi::Boolean::New(env, ev->down));
        obj.Set("extended", Napi::Boolean::New(env, ev->extended));
        obj.Set("alt", Napi::Boolean::New(env, ev->alt));
        obj.Set("ctrl", Napi::Boolean::New(env, ev->ctrl));
        obj.Set("shift", Napi::Boolean::New(env, ev->shift));
        callback.Call({ obj });
    }
    delete ev;
}

static LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION && lParam) {
        const KBDLLHOOKSTRUCT* k = reinterpret_cast<const KBDLLHOOKSTRUCT*>(lParam);
        if (!(k->flags & LLKHF_INJECTED)) {
            const bool down = (k->flags & LLKHF_UP) == 0;
            bool swallow = false;
            if (down) {
                if (g_hookEnabled.load() && ForegroundIsHookTarget() && IsSystemKeyChord(k)) {
                    swallow = true;
                    g_swallowedDown.insert(k->vkCode);
                }
            } else {
                auto it = g_swallowedDown.find(k->vkCode);
                if (it != g_swallowedDown.end()) {
                    swallow = true;
                    g_swallowedDown.erase(it);
                }
            }
            if (swallow) {
                HookKeyEvent* ev = new HookKeyEvent{
                    k->vkCode,
                    k->scanCode,
                    down,
                    (k->flags & LLKHF_EXTENDED) != 0,
                    (k->flags & LLKHF_ALTDOWN) != 0,
                    (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0,
                    (GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0,
                };
                if (g_hookTsfn.NonBlockingCall(ev, CallHookCallback) != napi_ok) delete ev;
                return 1;
            }
        }
    }
    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

static void HookThreadMain(HANDLE readyEvent) {
    g_hookThreadId = GetCurrentThreadId();
    // Force-create the thread's message queue so PostThreadMessage(WM_QUIT)
    // from Stop can never race ahead of it.
    MSG msg;
    PeekMessageW(&msg, nullptr, WM_USER, WM_USER, PM_NOREMOVE);
    g_hook = SetWindowsHookExW(WH_KEYBOARD_LL, LowLevelKeyboardProc, GetModuleHandleW(nullptr), 0);
    g_hookRunning.store(g_hook != nullptr);
    SetEvent(readyEvent);
    if (!g_hook) return;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    UnhookWindowsHookEx(g_hook);
    g_hook = nullptr;
    g_swallowedDown.clear();
    g_hookRunning.store(false);
}

// startKeyboardHook(callback) -> boolean. Installs the hook (disabled until
// setKeyboardHookEnabled(true)). Idempotent while running.
Napi::Value StartKeyboardHook(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Function expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (g_hookRunning.load()) return Napi::Boolean::New(env, true);
    if (g_hookThread.joinable()) g_hookThread.join();

    g_hookTsfn = Napi::ThreadSafeFunction::New(env, info[0].As<Napi::Function>(), "remote365-keyboard-hook", 0, 1);
    // Never keep the process alive just because a hook is installed.
    g_hookTsfn.Unref(env);

    HANDLE ready = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    g_hookThread = std::thread(HookThreadMain, ready);
    WaitForSingleObject(ready, 3000);
    CloseHandle(ready);

    if (!g_hookRunning.load()) {
        if (g_hookThread.joinable()) g_hookThread.join();
        g_hookTsfn.Release();
        g_hookTsfn = Napi::ThreadSafeFunction();
        return Napi::Boolean::New(env, false);
    }
    return Napi::Boolean::New(env, true);
}

Napi::Value StopKeyboardHook(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    g_hookEnabled.store(false);
    if (g_hookRunning.load() && g_hookThreadId) {
        PostThreadMessageW(g_hookThreadId, WM_QUIT, 0, 0);
    }
    if (g_hookThread.joinable()) g_hookThread.join();
    g_hookThreadId = 0;
    if (g_hookTsfn) {
        g_hookTsfn.Release();
        g_hookTsfn = Napi::ThreadSafeFunction();
    }
    return env.Null();
}

Napi::Value SetKeyboardHookEnabled(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    const bool enabled = info.Length() > 0 && info[0].ToBoolean().Value();
    g_hookEnabled.store(enabled);
    return env.Null();
}

// setKeyboardHookTarget(hwnd) — the top-level window whose foreground state
// arms the hook. HWNDs are 32-bit values even on x64, so a JS number is exact.
Napi::Value SetKeyboardHookTarget(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    HWND hwnd = nullptr;
    if (info.Length() > 0 && info[0].IsNumber()) {
        hwnd = reinterpret_cast<HWND>((uintptr_t)info[0].As<Napi::Number>().DoubleValue());
    } else if (info.Length() > 0 && info[0].IsBigInt()) {
        bool lossless = false;
        hwnd = reinterpret_cast<HWND>((uintptr_t)info[0].As<Napi::BigInt>().Uint64Value(&lossless));
    }
    g_hookTarget.store(hwnd);
    return env.Null();
}

Napi::Value IsKeyboardHookActive(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), g_hookRunning.load() && g_hookEnabled.load());
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "startKeyboardHook"), Napi::Function::New(env, StartKeyboardHook));
    exports.Set(Napi::String::New(env, "stopKeyboardHook"), Napi::Function::New(env, StopKeyboardHook));
    exports.Set(Napi::String::New(env, "setKeyboardHookEnabled"), Napi::Function::New(env, SetKeyboardHookEnabled));
    exports.Set(Napi::String::New(env, "setKeyboardHookTarget"), Napi::Function::New(env, SetKeyboardHookTarget));
    exports.Set(Napi::String::New(env, "isKeyboardHookActive"), Napi::Function::New(env, IsKeyboardHookActive));
    exports.Set(Napi::String::New(env, "isKeyToggled"), Napi::Function::New(env, IsKeyToggled));
    exports.Set(Napi::String::New(env, "injectMouseMove"), Napi::Function::New(env, InjectMouseMove));
    exports.Set(Napi::String::New(env, "injectMouseAction"), Napi::Function::New(env, InjectMouseAction));
    exports.Set(Napi::String::New(env, "injectMouseScroll"), Napi::Function::New(env, InjectMouseScroll));
    exports.Set(Napi::String::New(env, "injectKeyAction"), Napi::Function::New(env, InjectKeyAction));
    exports.Set(Napi::String::New(env, "injectText"), Napi::Function::New(env, InjectText));
    exports.Set(Napi::String::New(env, "focusIsEditable"), Napi::Function::New(env, FocusIsEditable));
    return exports;
}

NODE_API_MODULE(input_injection, Init)
