// Remote365InputSvc / injector — Milestone M2.
//
// Opens the named pipe \\.\pipe\remote365-input, reads length-prefixed JSON frames
// from the Remote 365 host (see apps/desktop/src/main/elevatedInput.ts), and injects
// the input with SendInput. Because it can run elevated / as SYSTEM, the injected
// input reaches Task Manager and other elevated windows (UIPI).
//
// Two run modes:
//   Remote365InputSvc.exe --console     -> run in the foreground (RUN ELEVATED to test
//                                          Task Manager control). This is the M2 test path.
//   Remote365InputSvc.exe --install      -> register the Windows service (LocalSystem, auto)
//   Remote365InputSvc.exe --uninstall    -> remove the service
//   Remote365InputSvc.exe --agent        -> injector worker; the SERVICE launches this in
//                                          the active session on winsta0\default. Not run
//                                          by hand. Logs to C:\ProgramData\Remote365InputSvc.log
//   (no args, launched by SCM)           -> the service supervisor (session 0)
//
// M3a (this file): a service in session 0 cannot SendInput into the interactive session,
// so the service supervisor duplicates its own SYSTEM token, retargets it to the active
// console session (SetTokenInformation TokenSessionId), and CreateProcessAsUser-launches
// the agent on "winsta0\\default". The agent is SYSTEM (system integrity) in the user's
// session, so its SendInput reaches Task Manager / elevated windows. It auto-restarts on
// session switch / agent exit.
// M3b (todo): when the input desktop is the secure desktop (UAC/logon), launch a second
// agent on "winsta0\\winlogon". M3c (todo): SendSAS for Ctrl+Alt+Del.
// See apps/desktop/docs/elevated-input-service.md.

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <sddl.h>
#include <wtsapi32.h>  // WTSQuerySessionInformation — is anyone signed in?
#include <userenv.h>   // CreateEnvironmentBlock for the pre-logon host process
#include <tlhelp32.h>  // process enumeration for the app supervisor (M5)
#include <string>
#include <vector>
#include <thread>
#include <cstdint>
#include <cstdlib>
#include <cstdio>
#include <cstdarg>
#include <cstring>   // memcpy for the capture frame copy
#include <share.h>   // _SH_DENYNO for shared log access (_wfsopen)

#pragma comment(lib, "Advapi32.lib")
#pragma comment(lib, "User32.lib")
#pragma comment(lib, "Gdi32.lib")   // GDI screen capture (BitBlt/StretchBlt/DIB)
#pragma comment(lib, "Wtsapi32.lib")
#pragma comment(lib, "Userenv.lib")

static const wchar_t* kPipeName = L"\\\\.\\pipe\\remote365-input";
static const wchar_t* kServiceName = L"Remote365InputSvc";

// ---- tiny JSON field readers (frames are flat objects) ----------------------
static bool jsonStr(const std::string& s, const char* key, std::string& out) {
    std::string k = std::string("\"") + key + "\"";
    size_t p = s.find(k);
    if (p == std::string::npos) return false;
    p = s.find(':', p + k.size());
    if (p == std::string::npos) return false;
    p = s.find('"', p);
    if (p == std::string::npos) return false;
    size_t e = s.find('"', p + 1);
    if (e == std::string::npos) return false;
    out = s.substr(p + 1, e - p - 1);
    return true;
}
static bool jsonNum(const std::string& s, const char* key, double& out) {
    std::string k = std::string("\"") + key + "\"";
    size_t p = s.find(k);
    if (p == std::string::npos) return false;
    p = s.find(':', p + k.size());
    if (p == std::string::npos) return false;
    out = strtod(s.c_str() + p + 1, nullptr);
    return true;
}
static bool jsonBool(const std::string& s, const char* key, bool& out) {
    std::string k = std::string("\"") + key + "\"";
    size_t p = s.find(k);
    if (p == std::string::npos) return false;
    p = s.find(':', p + k.size());
    if (p == std::string::npos) return false;
    out = s.find("true", p) == p + 1 || s.find("true", p) < p + 6;
    return true;
}

// ---- injection --------------------------------------------------------------
static void injectMove(double xNorm, double yNorm) {
    // The host already normalizes the point to 0..1 across the VIRTUAL desktop
    // (mapRemotePointToVirtualDesktop in apps/desktop/src/main/index.ts), so map
    // straight to the 0..65535 absolute range. MOUSEEVENTF_VIRTUALDESK spreads that
    // range across the entire multi-monitor virtual desktop.
    if (xNorm < 0) xNorm = 0; else if (xNorm > 1) xNorm = 1;
    if (yNorm < 0) yNorm = 0; else if (yNorm > 1) yNorm = 1;
    INPUT in = {};
    in.type = INPUT_MOUSE;
    in.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    in.mi.dx = (LONG)(xNorm * 65535.0);
    in.mi.dy = (LONG)(yNorm * 65535.0);
    SendInput(1, &in, sizeof(in));
}
static void injectButton(const std::string& button, bool down) {
    INPUT in = {};
    in.type = INPUT_MOUSE;
    if (button == "right")      in.mi.dwFlags = down ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
    else if (button == "middle") in.mi.dwFlags = down ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
    else                         in.mi.dwFlags = down ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
    SendInput(1, &in, sizeof(in));
}
static void injectScroll(double dx, double dy) {
    if (dy != 0) {
        INPUT in = {}; in.type = INPUT_MOUSE; in.mi.dwFlags = MOUSEEVENTF_WHEEL;
        in.mi.mouseData = (DWORD)(-dy); SendInput(1, &in, sizeof(in));
    }
    if (dx != 0) {
        INPUT in = {}; in.type = INPUT_MOUSE; in.mi.dwFlags = MOUSEEVENTF_HWHEEL;
        in.mi.mouseData = (DWORD)(dx); SendInput(1, &in, sizeof(in));
    }
}
static bool isExtendedKey(WORD vk) {
    switch (vk) {
        case VK_RCONTROL: case VK_RMENU: case VK_INSERT: case VK_DELETE: case VK_HOME:
        case VK_END: case VK_PRIOR: case VK_NEXT: case VK_LEFT: case VK_RIGHT:
        case VK_UP: case VK_DOWN: case VK_NUMLOCK: case VK_LWIN: case VK_RWIN:
            return true;
        default: return false;
    }
}
static void injectKey(WORD vk, bool down) {
    INPUT in = {};
    in.type = INPUT_KEYBOARD;
    in.ki.wVk = vk;
    in.ki.wScan = (WORD)MapVirtualKeyW(vk, MAPVK_VK_TO_VSC);
    in.ki.dwFlags = (down ? 0 : KEYEVENTF_KEYUP) | (isExtendedKey(vk) ? KEYEVENTF_EXTENDEDKEY : 0);
    SendInput(1, &in, sizeof(in));
}
static void injectText(const std::string& utf8) {
    int wlen = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, nullptr, 0);
    if (wlen <= 1) return;
    std::wstring w(wlen, 0);
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, &w[0], wlen);
    std::vector<INPUT> inputs;
    inputs.reserve((w.size() - 1) * 2);
    for (size_t i = 0; i + 1 < w.size(); ++i) {
        INPUT down = {};
        down.type = INPUT_KEYBOARD;
        down.ki.wScan = w[i];
        down.ki.dwFlags = KEYEVENTF_UNICODE;
        inputs.push_back(down);
        INPUT up = down;
        up.ki.dwFlags |= KEYEVENTF_KEYUP;
        inputs.push_back(up);
    }
    if (!inputs.empty()) SendInput((UINT)inputs.size(), inputs.data(), sizeof(INPUT));
}

// ---- logging ----------------------------------------------------------------
static bool g_console = false;        // --console: also write to stdout
static bool g_verbose = false;        // log every input frame (console only)
static FILE* g_logFile = nullptr;     // file sink for --agent / service supervisor
static unsigned long g_moveCount = 0;

static void openLog() {
    if (!g_logFile) {
        // _SH_DENYNO so the supervisor, the agent, and `type` / Get-Content can all
        // read/write the log at once (otherwise it's locked while the service runs).
        g_logFile = _wfsopen(L"C:\\ProgramData\\Remote365InputSvc.log", L"a+, ccs=UTF-8", _SH_DENYNO);
    }
}

static void logf(const wchar_t* fmt, ...) {
    wchar_t buf[1200];
    va_list ap; va_start(ap, fmt);
    _vsnwprintf_s(buf, 1200, _TRUNCATE, fmt, ap);
    va_end(ap);
    if (g_console) { wprintf(L"%s\n", buf); fflush(stdout); }
    if (g_logFile) {
        SYSTEMTIME st; GetLocalTime(&st);
        fwprintf(g_logFile, L"%02d:%02d:%02d  %s\n", st.wHour, st.wMinute, st.wSecond, buf);
        fflush(g_logFile);
    }
}

// ---- secure desktop following (M3b) -----------------------------------------
// A SYSTEM agent can follow the active INPUT desktop so SendInput also reaches the
// secure desktop (UAC consent prompt / Ctrl-Alt-Del / lock screen). Injection is
// per-thread-desktop, so the injection thread re-attaches itself whenever the input
// desktop changes (Default <-> Winlogon). Only meaningful when running as SYSTEM
// (the service agent); a plain elevated --console can't open the Winlogon desktop.
static bool  g_followInputDesktop = false;
static HDESK g_curDesk = nullptr;
static DWORD g_lastDeskCheck = 0;

static void ensureOnInputDesktop() {
    if (!g_followInputDesktop) return;
    DWORD now = GetTickCount();
    if (now - g_lastDeskCheck < 200) return;   // throttle the desktop probe
    g_lastDeskCheck = now;
    HDESK input = OpenInputDesktop(0, FALSE, MAXIMUM_ALLOWED);
    if (!input) return;
    wchar_t name[256] = {}; DWORD len = 0;
    GetUserObjectInformationW(input, UOI_NAME, name, sizeof(name), &len);
    static std::wstring curName;
    std::wstring nm = name;
    if (curName != nm) {
        if (SetThreadDesktop(input)) {
            if (g_curDesk) CloseDesktop(g_curDesk);
            g_curDesk = input;
            curName = nm;
            logf(L"[desktop] injecting on '%s'", name);
            return;
        }
        logf(L"[desktop] SetThreadDesktop('%s') failed %lu", name, GetLastError());
    }
    CloseDesktop(input);
}

static void dispatch(const std::string& frame) {
    ensureOnInputDesktop();   // M3b: keep injecting on whatever desktop is active
    std::string t;
    if (!jsonStr(frame, "t", t)) return;
    if (t == "move") {
        double x = 0, y = 0; jsonNum(frame, "x", x); jsonNum(frame, "y", y); injectMove(x, y);
        if (g_verbose && (++g_moveCount % 60 == 1)) logf(L"  move -> (%.3f, %.3f) norm", x, y);
    }
    else if (t == "btn") {
        std::string b = "left"; bool d = false; jsonStr(frame, "button", b); jsonBool(frame, "down", d); injectButton(b, d);
        // Verbose-only: fwprintf+fflush hits the disk per click and stalls the
        // single-threaded pipe loop, delaying any moves queued behind it.
        if (g_verbose) logf(L"  btn  %hs %s", b.c_str(), d ? L"down" : L"up");
    }
    else if (t == "scroll") {
        double dx = 0, dy = 0; jsonNum(frame, "dx", dx); jsonNum(frame, "dy", dy); injectScroll(dx, dy);
        if (g_verbose) logf(L"  scroll (%.0f, %.0f)", dx, dy);
    }
    else if (t == "key") {
        double vk = 0; bool d = false; jsonNum(frame, "vk", vk); jsonBool(frame, "down", d); injectKey((WORD)vk, d);
        // Verbose-only: an unconditional fwprintf+fflush per key event stalls the
        // single-threaded pipe loop mid-typing burst, and VK codes in a
        // world-readable log are a keystroke record nobody asked for.
        if (g_verbose) logf(L"  key  vk=%d %s", (int)vk, d ? L"down" : L"up");
    }
    else if (t == "text") {
        // Never log typed content — length only, and only when verbose.
        std::string s; if (jsonStr(frame, "s", s)) { injectText(s); if (g_verbose) logf(L"  text (%zu chars)", s.size()); }
    }
    // {t:"ping"} -> no-op.
}

// ---- pipe server ------------------------------------------------------------
static HANDLE createPipe() {
    // ACL: SYSTEM + Administrators full, Interactive users read/write. Harden in M4.
    PSECURITY_DESCRIPTOR sd = nullptr;
    SECURITY_ATTRIBUTES sa = {};
    if (ConvertStringSecurityDescriptorToSecurityDescriptorW(
            L"D:(A;;FA;;;SY)(A;;FA;;;BA)(A;;0x12019b;;;IU)", SDDL_REVISION_1, &sd, nullptr)) {
        sa.nLength = sizeof(sa);
        sa.lpSecurityDescriptor = sd;
    }
    HANDLE h = CreateNamedPipeW(
        kPipeName, PIPE_ACCESS_DUPLEX,
        PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
        1, 4096, 64 * 1024, 0, sa.lpSecurityDescriptor ? &sa : nullptr);
    if (sd) LocalFree(sd);
    return h;
}

static volatile bool g_running = true;

static bool readExact(HANDLE pipe, void* buf, DWORD n) {
    DWORD got = 0;
    while (got < n) {
        DWORD r = 0;
        if (!ReadFile(pipe, (char*)buf + got, n - got, &r, nullptr) || r == 0) return false;
        got += r;
    }
    return true;
}

static void serveLoop() {
    while (g_running) {
        HANDLE pipe = createPipe();
        if (pipe == INVALID_HANDLE_VALUE) {
            logf(L"[!] CreateNamedPipe failed (err %lu)", GetLastError());
            Sleep(1000); continue;
        }
        BOOL ok = ConnectNamedPipe(pipe, nullptr) ? TRUE : (GetLastError() == ERROR_PIPE_CONNECTED);
        if (!ok) { CloseHandle(pipe); continue; }
        logf(L"[+] host connected");
        while (g_running) {
            uint32_t len = 0;
            if (!readExact(pipe, &len, 4)) break;
            if (len == 0 || len > 64 * 1024) break;
            std::string frame; frame.resize(len);
            if (!readExact(pipe, &frame[0], len)) break;
            dispatch(frame);
        }
        logf(L"[-] host disconnected");
        DisconnectNamedPipe(pipe);
        CloseHandle(pipe);
    }
}

// ---- secure-desktop capture (M3d) -------------------------------------------
// The host's DXGI screen capture runs in the USER session and returns nothing
// the moment the machine locks — the lock / UAC / PIN screen lives on the
// secure (Winlogon) desktop, which a user-session process can't grab. This
// SYSTEM agent already follows the input desktop, so a GDI BitBlt here captures
// whatever is on screen, including the PIN screen, and serves it to the host
// over \\.\pipe\remote365-capture. Pull model: the host writes [u32 width]
// [u32 height] (the exact size its FFmpeg input expects) and we reply
// [u32 len][BGRA bytes] (len == width*height*4, or 0 if the grab failed). The
// host only pulls while its own DXGI capture is blank, so this costs nothing
// while the machine is unlocked.
static const wchar_t* kCapturePipeName = L"\\\\.\\pipe\\remote365-capture";

// Keep the capture thread attached to the current input desktop so BitBlt sees
// the secure desktop when it's active. Kept separate from the input thread's
// follower (g_curDesk) so the two threads never fight over one HDESK handle.
static HDESK g_capDesk = nullptr;
static void captureFollowInputDesktop() {
    HDESK input = OpenInputDesktop(0, FALSE, GENERIC_ALL);
    if (!input) return;
    wchar_t name[256] = {}; DWORD len = 0;
    GetUserObjectInformationW(input, UOI_NAME, name, sizeof(name), &len);
    static std::wstring curName;
    std::wstring nm = name;
    if (curName != nm) {
        if (SetThreadDesktop(input)) {
            if (g_capDesk) CloseDesktop(g_capDesk);
            g_capDesk = input; curName = nm;
            logf(L"[capture] now on desktop '%s'", name);
            return;
        }
        logf(L"[capture] SetThreadDesktop('%s') failed %lu", name, GetLastError());
    }
    CloseDesktop(input);
}

// Grab the primary screen scaled to width x height as top-down 32bpp BGRA.
// Returns false on failure; on success `out` holds width*height*4 bytes.
static bool grabScreen(int width, int height, std::vector<uint8_t>& out) {
    if (width <= 0 || height <= 0 || width > 8192 || height > 8192) return false;
    captureFollowInputDesktop();
    HDC hScreen = GetDC(nullptr);   // DC of the calling thread's (input) desktop
    if (!hScreen) return false;
    int sw = GetSystemMetrics(SM_CXSCREEN);
    int sh = GetSystemMetrics(SM_CYSCREEN);
    bool ok = false;
    if (sw > 0 && sh > 0) {
        HDC hMem = CreateCompatibleDC(hScreen);
        if (hMem) {
            BITMAPINFO bmi = {};
            bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
            bmi.bmiHeader.biWidth = width;
            bmi.bmiHeader.biHeight = -height;   // negative => top-down rows
            bmi.bmiHeader.biPlanes = 1;
            bmi.bmiHeader.biBitCount = 32;
            bmi.bmiHeader.biCompression = BI_RGB;
            void* bits = nullptr;
            HBITMAP dib = CreateDIBSection(hMem, &bmi, DIB_RGB_COLORS, &bits, nullptr, 0);
            if (dib && bits) {
                HGDIOBJ oldBmp = SelectObject(hMem, dib);
                SetStretchBltMode(hMem, HALFTONE);
                SetBrushOrgEx(hMem, 0, 0, nullptr);
                if (StretchBlt(hMem, 0, 0, width, height, hScreen, 0, 0, sw, sh, SRCCOPY)) {
                    const size_t n = (size_t)width * (size_t)height * 4;
                    out.resize(n);
                    memcpy(out.data(), bits, n);
                    ok = true;
                }
                SelectObject(hMem, oldBmp);
            }
            if (dib) DeleteObject(dib);
            DeleteDC(hMem);
        }
    }
    ReleaseDC(nullptr, hScreen);
    return ok;
}

static HANDLE createCapturePipe() {
    PSECURITY_DESCRIPTOR sd = nullptr;
    SECURITY_ATTRIBUTES sa = {};
    if (ConvertStringSecurityDescriptorToSecurityDescriptorW(
            L"D:(A;;FA;;;SY)(A;;FA;;;BA)(A;;0x12019b;;;IU)", SDDL_REVISION_1, &sd, nullptr)) {
        sa.nLength = sizeof(sa);
        sa.lpSecurityDescriptor = sd;
    }
    HANDLE h = CreateNamedPipeW(
        kCapturePipeName, PIPE_ACCESS_DUPLEX,
        PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
        1, 8 * 1024 * 1024, 64 * 1024, 0, sa.lpSecurityDescriptor ? &sa : nullptr);
    if (sd) LocalFree(sd);
    return h;
}

static bool writeExact(HANDLE pipe, const void* buf, DWORD n) {
    DWORD sent = 0;
    while (sent < n) {
        DWORD w = 0;
        if (!WriteFile(pipe, (const char*)buf + sent, n - sent, &w, nullptr) || w == 0) return false;
        sent += w;
    }
    return true;
}

static void captureServeLoop() {
    std::vector<uint8_t> frame;
    while (g_running) {
        HANDLE pipe = createCapturePipe();
        if (pipe == INVALID_HANDLE_VALUE) {
            logf(L"[capture] CreateNamedPipe failed (err %lu)", GetLastError());
            Sleep(1000); continue;
        }
        BOOL ok = ConnectNamedPipe(pipe, nullptr) ? TRUE : (GetLastError() == ERROR_PIPE_CONNECTED);
        if (!ok) { CloseHandle(pipe); continue; }
        logf(L"[capture] host connected");
        while (g_running) {
            uint32_t dims[2] = { 0, 0 };
            if (!readExact(pipe, dims, sizeof(dims))) break;
            uint32_t len = 0;
            if (grabScreen((int)dims[0], (int)dims[1], frame)) len = (uint32_t)frame.size();
            if (!writeExact(pipe, &len, 4)) break;
            if (len && !writeExact(pipe, frame.data(), len)) break;
        }
        logf(L"[capture] host disconnected");
        DisconnectNamedPipe(pipe);
        CloseHandle(pipe);
    }
}

// ---- per-session agent (M3a) ------------------------------------------------
// The service (session 0) can't SendInput into the interactive desktop, so it spawns
// this same exe with --agent as SYSTEM inside the active console session.

static bool enablePriv(const wchar_t* name) {  // pass explicit L"Se..." (SE_*_NAME flips on UNICODE)
    HANDLE tok;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &tok)) return false;
    LUID luid; bool ok = false;
    if (LookupPrivilegeValueW(nullptr, name, &luid)) {
        TOKEN_PRIVILEGES tp = {}; tp.PrivilegeCount = 1; tp.Privileges[0].Luid = luid;
        tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
        ok = AdjustTokenPrivileges(tok, FALSE, &tp, sizeof(tp), nullptr, nullptr) && GetLastError() == ERROR_SUCCESS;
    }
    CloseHandle(tok);
    return ok;
}

static HANDLE g_agentProc = nullptr;
static DWORD  g_agentSession = 0xFFFFFFFF;

// Launch the injector as SYSTEM in `sessionId` on `desktop` (e.g. L"winsta0\\default").
static bool launchAgent(DWORD sessionId, const wchar_t* desktop) {
    HANDLE selfTok = nullptr;
    if (!OpenProcessToken(GetCurrentProcess(),
            TOKEN_DUPLICATE | TOKEN_QUERY | TOKEN_ASSIGN_PRIMARY | TOKEN_ADJUST_DEFAULT | TOKEN_ADJUST_SESSIONID,
            &selfTok)) {
        logf(L"OpenProcessToken failed %lu", GetLastError());
        return false;
    }
    HANDLE dup = nullptr;
    BOOL dok = DuplicateTokenEx(selfTok, MAXIMUM_ALLOWED, nullptr, SecurityIdentification, TokenPrimary, &dup);
    CloseHandle(selfTok);
    if (!dok) { logf(L"DuplicateTokenEx failed %lu", GetLastError()); return false; }

    if (!SetTokenInformation(dup, TokenSessionId, &sessionId, sizeof(sessionId)))
        logf(L"SetTokenInformation(session=%lu) failed %lu (continuing)", sessionId, GetLastError());

    wchar_t exe[MAX_PATH]; GetModuleFileNameW(nullptr, exe, MAX_PATH);
    std::wstring cmd = std::wstring(L"\"") + exe + L"\" --agent";
    std::wstring deskBuf = desktop;
    STARTUPINFOW si = {}; si.cb = sizeof(si); si.lpDesktop = &deskBuf[0];
    PROCESS_INFORMATION pi = {};
    BOOL ok = CreateProcessAsUserW(dup, exe, &cmd[0], nullptr, nullptr, FALSE,
        CREATE_NO_WINDOW | DETACHED_PROCESS, nullptr, nullptr, &si, &pi);
    CloseHandle(dup);
    if (!ok) { logf(L"CreateProcessAsUser(session=%lu, %s) failed %lu", sessionId, desktop, GetLastError()); return false; }
    CloseHandle(pi.hThread);
    g_agentProc = pi.hProcess;
    g_agentSession = sessionId;
    logf(L"agent started: session=%lu desktop=%s pid=%lu", sessionId, desktop, pi.dwProcessId);
    return true;
}

static void stopAgent() {
    if (g_agentProc) {
        TerminateProcess(g_agentProc, 0);
        CloseHandle(g_agentProc);
        g_agentProc = nullptr;
        g_agentSession = 0xFFFFFFFF;
    }
}

// ---- pre-logon host (M4) ----------------------------------------------------
// The Remote 365 app is a per-user program: the HKCU Run entry and its keep-alive
// task both need someone signed in. So a PC that reboots and stops at the sign-in
// screen stayed OFFLINE until a human walked over and logged in — the single
// biggest "why is my device offline" cause on the fleet.
//
// This service already runs at boot as LocalSystem and already launches an agent
// into the console session, so it is the one component that can fix it: while the
// console session has NO signed-in user, launch the app as SYSTEM with --prelogon.
// It registers with the machine credential in ProgramData (no user profile, no
// DPAPI) and streams the sign-in screen through the capture pipe above. The
// instant a user logs on we kill it and their own instance takes over, so the
// device is never registered twice.

static HANDLE g_hostProc = nullptr;
static DWORD  g_hostSession = 0xFFFFFFFF;
static ULONGLONG g_hostLastLaunch = 0;

// A console session exists from boot (winlogon owns it), so its mere presence
// says nothing. An empty WTSUserName is what distinguishes "sign-in screen" from
// "someone is signed in" — including the locked-but-signed-in case, where the
// user's own instance is already running and must be left alone.
static bool sessionHasUser(DWORD sess) {
    LPWSTR buf = nullptr; DWORD bytes = 0;
    if (!WTSQuerySessionInformationW(WTS_CURRENT_SERVER_HANDLE, sess, WTSUserName, &buf, &bytes))
        return false;
    bool present = buf && buf[0] != L'\0';
    if (buf) WTSFreeMemory(buf);
    return present;
}

// Pull the installed app's path out of the machine credential the app writes
// (see apps/desktop/src/main/unattendedHost.ts). Deliberately NOT a registry or
// hardcoded lookup: the app is installed per-user under %LocalAppData%, so only
// the app itself knows where it actually lives on this machine.
static bool readTextFile(const wchar_t* path, std::string& out) {
    FILE* f = _wfsopen(path, L"rb", _SH_DENYNO);
    if (!f) return false;
    out.clear();
    char chunk[1024];
    size_t n;
    while ((n = fread(chunk, 1, sizeof(chunk), f)) > 0) out.append(chunk, n);
    fclose(f);
    return true;
}

static bool readUnattendedExePath(std::wstring& out) {
    std::string json;
    if (!readTextFile(L"C:\\ProgramData\\Remote365\\unattended-host.json", json)) return false;

    std::string raw;
    if (!jsonStr(json, "exePath", raw) || raw.empty()) return false;
    // JSON escapes every backslash in a Windows path; unescape before use.
    std::string path;
    for (size_t i = 0; i < raw.size(); i++) {
        if (raw[i] == '\\' && i + 1 < raw.size() && raw[i + 1] == '\\') { path.push_back('\\'); i++; }
        else path.push_back(raw[i]);
    }
    int wide = MultiByteToWideChar(CP_UTF8, 0, path.c_str(), -1, nullptr, 0);
    if (wide <= 1) return false;
    out.assign((size_t)wide - 1, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, path.c_str(), -1, &out[0], wide);
    return GetFileAttributesW(out.c_str()) != INVALID_FILE_ATTRIBUTES;
}

static void stopPreLogonHost() {
    if (!g_hostProc) return;
    TerminateProcess(g_hostProc, 0);
    CloseHandle(g_hostProc);
    g_hostProc = nullptr;
    g_hostSession = 0xFFFFFFFF;
    logf(L"[prelogon] host stopped");
}

static bool launchPreLogonHost(DWORD sessionId) {
    // Throttle: a host that crashes on startup must not be respawned every
    // 2 s forever. One attempt per 20 s is plenty for a real recovery.
    ULONGLONG now = GetTickCount64();
    if (g_hostLastLaunch && now - g_hostLastLaunch < 20000) return false;
    g_hostLastLaunch = now;

    std::wstring exe;
    if (!readUnattendedExePath(exe)) {
        static bool warned = false;
        if (!warned) {
            warned = true;
            logf(L"[prelogon] no machine credential yet — sign in once with Remote 365 running to enable pre-logon hosting");
        }
        return false;
    }

    HANDLE selfTok = nullptr;
    if (!OpenProcessToken(GetCurrentProcess(),
            TOKEN_DUPLICATE | TOKEN_QUERY | TOKEN_ASSIGN_PRIMARY | TOKEN_ADJUST_DEFAULT | TOKEN_ADJUST_SESSIONID,
            &selfTok)) {
        logf(L"[prelogon] OpenProcessToken failed %lu", GetLastError());
        return false;
    }
    HANDLE dup = nullptr;
    BOOL dok = DuplicateTokenEx(selfTok, MAXIMUM_ALLOWED, nullptr, SecurityIdentification, TokenPrimary, &dup);
    CloseHandle(selfTok);
    if (!dok) { logf(L"[prelogon] DuplicateTokenEx failed %lu", GetLastError()); return false; }

    if (!SetTokenInformation(dup, TokenSessionId, &sessionId, sizeof(sessionId)))
        logf(L"[prelogon] SetTokenInformation(session=%lu) failed %lu (continuing)", sessionId, GetLastError());

    // Electron resolves its paths from the environment; without a proper block
    // the SYSTEM profile's AppData is not described and startup can fail.
    LPVOID env = nullptr;
    if (!CreateEnvironmentBlock(&env, dup, FALSE)) env = nullptr;

    // --no-sandbox: the Chromium sandbox cannot initialise under a retargeted
    // SYSTEM token. --disable-gpu: there is no GPU session to attach to before
    // logon, and this instance never draws a window anyway (video capture and
    // encoding do not go through Chromium).
    std::wstring cmd = std::wstring(L"\"") + exe + L"\" --prelogon --no-sandbox --disable-gpu";
    std::wstring deskBuf = L"winsta0\\default";
    STARTUPINFOW si = {}; si.cb = sizeof(si); si.lpDesktop = &deskBuf[0];
    PROCESS_INFORMATION pi = {};
    DWORD flags = CREATE_NO_WINDOW | (env ? CREATE_UNICODE_ENVIRONMENT : 0);
    BOOL ok = CreateProcessAsUserW(dup, exe.c_str(), &cmd[0], nullptr, nullptr, FALSE,
        flags, env, nullptr, &si, &pi);
    if (env) DestroyEnvironmentBlock(env);
    CloseHandle(dup);
    if (!ok) { logf(L"[prelogon] CreateProcessAsUser(session=%lu) failed %lu", sessionId, GetLastError()); return false; }
    CloseHandle(pi.hThread);
    g_hostProc = pi.hProcess;
    g_hostSession = sessionId;
    logf(L"[prelogon] host started: session=%lu pid=%lu exe=%s", sessionId, pi.dwProcessId, exe.c_str());
    return true;
}

// ---- in-session app supervisor (M5) -----------------------------------------
// The app keeps itself alive with a per-user Scheduled Task, but on locked-down
// fleets that task can never be created: endpoint security blocks the app from
// spawning schtasks.exe at all (`[KeepAlive] Failed to arm task: spawn EPERM`,
// PureVoip PV1, Jul 29 2026). Those machines end up with NO recovery — and they
// are exactly the machines nobody can walk over to. This service can do the same
// job, and a signed service starting a process is ordinary behaviour that AV has
// no reason to block.
//
// Security note: the exe is derived from the logged-on user's OWN profile, never
// read from a file a normal user could write. Otherwise anyone could point this
// at their own binary and have SYSTEM launch it in someone else's session.

static const wchar_t* kAppExeName = L"Remote 365.exe";
static ULONGLONG g_appLastLaunch = 0;

static std::wstring readSuperviseFlag() {
    std::string body;
    if (!readTextFile(L"C:\\ProgramData\\Remote365\\app-supervise.flag", body)) return L"";
    for (size_t i = 0; i < body.size(); i++) {
        if (body[i] == '0' || body[i] == '1') return body[i] == '1' ? L"1" : L"0";
    }
    return L"";
}

// Snapshot-based: is `exeName` running in session `sess`? Fails SAFE (returns
// true) so a snapshot error can never turn into a relaunch storm.
static bool isProcessInSession(const wchar_t* exeName, DWORD sess, bool anySession = false) {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return true;
    PROCESSENTRY32W pe = {}; pe.dwSize = sizeof(pe);
    bool found = false;
    if (Process32FirstW(snap, &pe)) {
        do {
            if (_wcsicmp(pe.szExeFile, exeName) != 0) continue;
            if (anySession) { found = true; break; }
            DWORD psess = 0xFFFFFFFF;
            if (ProcessIdToSessionId(pe.th32ProcessID, &psess) && psess == sess) { found = true; break; }
        } while (Process32NextW(snap, &pe));
    }
    CloseHandle(snap);
    return found;
}

// An update in flight owns the install directory — never launch into a swap.
static bool isSetupRunning() {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return true;
    PROCESSENTRY32W pe = {}; pe.dwSize = sizeof(pe);
    bool found = false;
    if (Process32FirstW(snap, &pe)) {
        do {
            if (_wcsnicmp(pe.szExeFile, L"Remote 365 Setup", 16) == 0) { found = true; break; }
        } while (Process32NextW(snap, &pe));
    }
    CloseHandle(snap);
    return found;
}

// Per-user install (electron-builder, perMachine:false) lives under the user's
// own profile, so resolve it FROM THEIR TOKEN rather than trusting any file.
static bool resolveUserAppPath(HANDLE userToken, std::wstring& out) {
    wchar_t profile[MAX_PATH]; DWORD len = MAX_PATH;
    if (!GetUserProfileDirectoryW(userToken, profile, &len)) return false;
    const wchar_t* candidates[] = {
        L"\\AppData\\Local\\Programs\\remote-365\\Remote 365.exe",
        L"\\AppData\\Local\\Programs\\Remote 365\\Remote 365.exe",
    };
    for (const wchar_t* c : candidates) {
        std::wstring p = std::wstring(profile) + c;
        if (GetFileAttributesW(p.c_str()) != INVALID_FILE_ATTRIBUTES) { out = p; return true; }
    }
    return false;
}

// Relaunch the app INSIDE the signed-in user's session, as that user (never as
// SYSTEM — it must be their app, with their profile and their settings).
static void superviseUserApp(DWORD sess) {
    if (readSuperviseFlag() != L"1") return;   // never started, or deliberately quit
    if (isProcessInSession(kAppExeName, sess)) return;

    ULONGLONG now = GetTickCount64();
    if (g_appLastLaunch && now - g_appLastLaunch < 60000) return;  // one attempt/min

    if (isSetupRunning()) return;

    HANDLE userTok = nullptr;
    if (!WTSQueryUserToken(sess, &userTok)) {
        logf(L"[supervise] WTSQueryUserToken(session=%lu) failed %lu", sess, GetLastError());
        return;
    }
    std::wstring exe;
    bool haveExe = resolveUserAppPath(userTok, exe);
    HANDLE dup = nullptr;
    BOOL dok = haveExe && DuplicateTokenEx(userTok, MAXIMUM_ALLOWED, nullptr, SecurityIdentification, TokenPrimary, &dup);
    CloseHandle(userTok);
    if (!haveExe) { logf(L"[supervise] app not installed in that user's profile"); return; }
    if (!dok) { logf(L"[supervise] DuplicateTokenEx failed %lu", GetLastError()); return; }

    g_appLastLaunch = now;
    LPVOID env = nullptr;
    if (!CreateEnvironmentBlock(&env, dup, FALSE)) env = nullptr;
    std::wstring cmd = std::wstring(L"\"") + exe + L"\" --hidden";
    std::wstring desk = L"winsta0\\default";
    STARTUPINFOW si = {}; si.cb = sizeof(si); si.lpDesktop = &desk[0];
    PROCESS_INFORMATION pi = {};
    DWORD flags = CREATE_NO_WINDOW | (env ? CREATE_UNICODE_ENVIRONMENT : 0);
    BOOL ok = CreateProcessAsUserW(dup, exe.c_str(), &cmd[0], nullptr, nullptr, FALSE,
        flags, env, nullptr, &si, &pi);
    if (env) DestroyEnvironmentBlock(env);
    CloseHandle(dup);
    if (!ok) { logf(L"[supervise] CreateProcessAsUser failed %lu", GetLastError()); return; }
    CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
    logf(L"[supervise] app was not running — relaunched in session %lu pid=%lu", sess, pi.dwProcessId);
}

// Keep exactly one agent alive in the active console session; relaunch on session
// switch or if it dies. (Secure-desktop/winlogon supervision is M3b.) Also owns
// the pre-logon host: running while nobody is signed in, gone the moment someone
// is (M4) — and keeps the user's own app alive while they are signed in (M5).
static void serviceSupervise() {
    enablePriv(L"SeTcbPrivilege");
    enablePriv(L"SeAssignPrimaryTokenPrivilege");
    enablePriv(L"SeIncreaseQuotaPrivilege");
    while (g_running) {
        DWORD sess = WTSGetActiveConsoleSessionId();
        if (sess == 0xFFFFFFFF) { stopAgent(); stopPreLogonHost(); Sleep(1500); continue; } // no console session
        bool dead = !g_agentProc || WaitForSingleObject(g_agentProc, 0) == WAIT_OBJECT_0;
        if (dead || sess != g_agentSession) {
            stopAgent();
            launchAgent(sess, L"winsta0\\default");
        }

        if (sessionHasUser(sess)) {
            // Someone is signed in (or the machine is merely locked): their own
            // instance owns presence. Two instances registering the same device
            // would fight over the signaling slot.
            stopPreLogonHost();
            // ...and make sure that instance is actually there (M5).
            superviseUserApp(sess);
        } else {
            bool hostDead = !g_hostProc || WaitForSingleObject(g_hostProc, 0) == WAIT_OBJECT_0;
            if (hostDead || sess != g_hostSession) {
                if (g_hostProc) { CloseHandle(g_hostProc); g_hostProc = nullptr; g_hostSession = 0xFFFFFFFF; }
                launchPreLogonHost(sess);
            }
        }
        Sleep(2000);
    }
    stopAgent();
    stopPreLogonHost();
}

// The agent worker: pipe server + injection, logging to file (no console).
// Make this process DPI-aware so the GDI screen grab captures PHYSICAL pixels,
// matching the host's DXGI resolution. Without it, a DPI-scaled desktop (e.g.
// 1920x1080 @ 150%) is captured at its logical size (1280x720) and the host
// upscales it to physical -> the lock/PIN screen looks zoomed and soft. Prefer
// per-monitor-v2; fall back to system-DPI-aware on older Windows. Loaded
// dynamically so it builds on any SDK. (HANDLE)-4 == PER_MONITOR_AWARE_V2.
static void enableDpiAwareness() {
    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    if (user32) {
        typedef BOOL (WINAPI *SetCtxFn)(HANDLE);
        auto setCtx = (SetCtxFn)GetProcAddress(user32, "SetProcessDpiAwarenessContext");
        if (setCtx && (setCtx((HANDLE)-4) || setCtx((HANDLE)-3))) return; // v2, then v1
    }
    SetProcessDPIAware(); // Vista+ fallback (system-DPI-aware)
}

static void runAgent() {
    openLog();
    enableDpiAwareness();          // capture physical pixels (no zoomed lock screen)
    g_verbose = false;
    g_followInputDesktop = true;   // M3b: SYSTEM agent follows Default <-> Winlogon
    DWORD sess = 0; ProcessIdToSessionId(GetCurrentProcessId(), &sess);
    logf(L"=== agent starting (session=%lu, secure-desktop follow ON) ===", sess);
    // M3d: serve secure-desktop frames (lock / UAC / PIN screen) to the host on a
    // second pipe, so the viewer can see and type the PIN while the machine is
    // locked. Runs alongside the input pipe on its own thread + own desktop handle.
    std::thread capThread(captureServeLoop);
    capThread.detach();
    serveLoop();
    logf(L"=== agent exiting ===");
}

// ---- service plumbing -------------------------------------------------------
static SERVICE_STATUS_HANDLE g_ssh = nullptr;
static SERVICE_STATUS g_status = {};

static void setState(DWORD s) {
    g_status.dwCurrentState = s;
    g_status.dwControlsAccepted = (s == SERVICE_RUNNING)
        ? (SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN | SERVICE_ACCEPT_SESSIONCHANGE) : 0;
    SetServiceStatus(g_ssh, &g_status);
}
static DWORD WINAPI svcCtrlEx(DWORD ctrl, DWORD, LPVOID, LPVOID) {
    switch (ctrl) {
        case SERVICE_CONTROL_STOP:
        case SERVICE_CONTROL_SHUTDOWN:
            g_running = false; setState(SERVICE_STOP_PENDING); break;
        case SERVICE_CONTROL_SESSIONCHANGE:
            // The supervise loop polls WTSGetActiveConsoleSessionId, so it picks up
            // logon/logoff/switch on its own; nothing required here.
            break;
        default: break;
    }
    return NO_ERROR;
}
static void WINAPI svcMain(DWORD, LPWSTR*) {
    g_ssh = RegisterServiceCtrlHandlerExW(kServiceName, svcCtrlEx, nullptr);
    g_status.dwServiceType = SERVICE_WIN32_OWN_PROCESS;
    openLog();
    logf(L"=== service supervisor starting ===");
    setState(SERVICE_RUNNING);
    serviceSupervise();   // spawns + supervises the per-session SYSTEM agent
    setState(SERVICE_STOPPED);
    logf(L"=== service supervisor stopped ===");
}

static bool waitServiceState(SC_HANDLE svc, DWORD want, int tries) {
    SERVICE_STATUS st = {};
    for (int i = 0; i < tries; i++) {
        if (!QueryServiceStatus(svc, &st)) return false;
        if (st.dwCurrentState == want) return true;
        Sleep(200);
    }
    return false;
}

// Idempotent install. If the service already exists we DO NOT delete + recreate
// it — that races with the SCM's "marked for delete" state and can momentarily
// leave NO service, which silently drops input to the non-elevated fallback and
// breaks Task Manager / secure-desktop control. Instead we repoint the existing
// service at this exe and restart it. Fresh installs retry on MARKED_FOR_DELETE.
static int installService() {
    wchar_t path[MAX_PATH]; GetModuleFileNameW(nullptr, path, MAX_PATH);
    SC_HANDLE scm = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_ALL_ACCESS);
    if (!scm) {
        wprintf(L"[install] FAILED to open Service Manager (err %lu).\n"
                L"          You must run this from an *elevated* (Administrator) prompt.\n", GetLastError());
        return 1;
    }

    SC_HANDLE svc = OpenServiceW(scm, kServiceName, SERVICE_ALL_ACCESS);
    if (svc) {
        // Already installed — repoint at this exe (in case the path changed) and restart.
        ChangeServiceConfigW(svc, SERVICE_NO_CHANGE, SERVICE_AUTO_START, SERVICE_NO_CHANGE,
                             path, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr);
        SERVICE_STATUS st = {};
        if (QueryServiceStatus(svc, &st) && st.dwCurrentState != SERVICE_STOPPED) {
            ControlService(svc, SERVICE_CONTROL_STOP, &st);
            waitServiceState(svc, SERVICE_STOPPED, 40);
        }
        BOOL started = StartServiceW(svc, 0, nullptr);
        DWORD e = GetLastError();
        wprintf(started ? L"[install] existing service repointed + restarted.\n"
                        : L"[install] repointed; StartService returned err %lu.\n", e);
        CloseServiceHandle(svc);
        CloseServiceHandle(scm);
        return started ? 0 : 1;
    }

    // Not installed — create it, retrying if a prior delete is still settling.
    for (int attempt = 0; attempt < 12 && !svc; attempt++) {
        svc = CreateServiceW(scm, kServiceName, L"Remote 365 Input Service",
            SERVICE_ALL_ACCESS, SERVICE_WIN32_OWN_PROCESS, SERVICE_AUTO_START, SERVICE_ERROR_NORMAL,
            path, nullptr, nullptr, nullptr, L"LocalSystem", nullptr);
        if (svc) break;
        DWORD e = GetLastError();
        if (e == ERROR_SERVICE_MARKED_FOR_DELETE || e == ERROR_SERVICE_EXISTS) {
            Sleep(500);
            svc = OpenServiceW(scm, kServiceName, SERVICE_ALL_ACCESS);
            if (svc) {  // it settled into an existing service — repoint + restart
                ChangeServiceConfigW(svc, SERVICE_NO_CHANGE, SERVICE_AUTO_START, SERVICE_NO_CHANGE,
                                     path, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr);
                SERVICE_STATUS st = {};
                if (QueryServiceStatus(svc, &st) && st.dwCurrentState != SERVICE_STOPPED) {
                    ControlService(svc, SERVICE_CONTROL_STOP, &st);
                    waitServiceState(svc, SERVICE_STOPPED, 40);
                }
            }
            continue;
        }
        wprintf(L"[install] CreateService FAILED (err %lu). Run from an elevated prompt.\n", e);
        CloseServiceHandle(scm);
        return 1;
    }
    if (svc) {
        BOOL started = StartServiceW(svc, 0, nullptr);
        wprintf(started ? L"[install] OK - service installed and STARTED.\n"
                          L"          Log: C:\\ProgramData\\Remote365InputSvc.log\n"
                        : L"[install] installed; StartService returned err %lu.\n", GetLastError());
        CloseServiceHandle(svc);
    }
    CloseServiceHandle(scm);
    return svc ? 0 : 1;
}
static int uninstallService() {
    SC_HANDLE scm = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT);
    if (!scm) { wprintf(L"[uninstall] open SCM failed (err %lu). Run elevated.\n", GetLastError()); return 1; }
    SC_HANDLE svc = OpenServiceW(scm, kServiceName, SERVICE_STOP | DELETE);
    if (svc) {
        SERVICE_STATUS s; ControlService(svc, SERVICE_CONTROL_STOP, &s);
        DeleteService(svc); CloseServiceHandle(svc);
        wprintf(L"[uninstall] OK - service stopped and removed.\n");
    } else {
        wprintf(L"[uninstall] not installed (err %lu).\n", GetLastError());
    }
    CloseServiceHandle(scm);
    return 0;
}

static bool isElevated() {
    HANDLE token = nullptr;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) return false;
    TOKEN_ELEVATION el = {}; DWORD sz = 0;
    bool ok = GetTokenInformation(token, TokenElevation, &el, sizeof(el), &sz) && el.TokenIsElevated;
    CloseHandle(token);
    return ok;
}

static void runConsole() {
    g_console = true;
    g_verbose = true;
    // Disable QuickEdit so a stray click in this window can't put the console into
    // "Select" mode, which would block our stdout writes and freeze injection mid-click.
    HANDLE hIn = GetStdHandle(STD_INPUT_HANDLE);
    DWORD cmode = 0;
    if (GetConsoleMode(hIn, &cmode)) {
        cmode = (cmode & ~ENABLE_QUICK_EDIT_MODE) | ENABLE_EXTENDED_FLAGS;
        SetConsoleMode(hIn, cmode);
    }
    wprintf(L"[Remote365InputSvc] console mode. Pipe: %s\n", kPipeName);
    if (isElevated()) {
        wprintf(L"[OK] running ELEVATED  -- can control Task Manager / elevated windows.\n");
    } else {
        wprintf(L"\n");
        wprintf(L"  ****************************************************************\n");
        wprintf(L"  *  NOT ELEVATED. You did NOT run this as administrator.       *\n");
        wprintf(L"  *  Input will be BLOCKED from Task Manager (UIPI).            *\n");
        wprintf(L"  *  Close this and right-click the exe -> Run as administrator.*\n");
        wprintf(L"  ****************************************************************\n");
    }
    wprintf(L"Waiting for the Remote 365 host to connect. Leave this window open.\n");
    wprintf(L"(Press Ctrl+C to quit.)\n\n");
    fflush(stdout);
    serveLoop();
}

int wmain(int argc, wchar_t** argv) {
    if (argc > 1) {
        std::wstring a = argv[1];
        if (a == L"--console")   { runConsole(); return 0; }
        if (a == L"--agent")     { runAgent(); return 0; }
        if (a == L"--install")   return installService();
        if (a == L"--uninstall") return uninstallService();
    }
    // No args: this is either the SCM launching us as a service, or a user who just
    // double-clicked / "Run as administrator". Try the service dispatcher first; if we
    // weren't started by the SCM it fails with ERROR_FAILED_SERVICE_CONTROLLER_CONNECT,
    // so fall back to interactive console mode (the M2 test path).
    SERVICE_TABLE_ENTRYW table[] = { { (LPWSTR)kServiceName, svcMain }, { nullptr, nullptr } };
    if (!StartServiceCtrlDispatcherW(table) &&
        GetLastError() == ERROR_FAILED_SERVICE_CONTROLLER_CONNECT) {
        runConsole();
    }
    return 0;
}
