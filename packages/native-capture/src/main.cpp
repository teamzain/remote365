#include <d3d11.h>
#include <dxgi1_2.h>
#include <dxgi1_5.h>
#include <iostream>
#include <napi.h>
#include <vector>
#include <windows.h>
#include <timeapi.h>

using namespace Napi;

class DXGICapture {
public:
  DXGICapture()
      : device(nullptr), context(nullptr), duplication(nullptr),
        stagingTexture(nullptr), currentOutputIndex(UINT_MAX), hasCapturedFrame(false) {}
  ~DXGICapture() { Cleanup(); }

  bool Initialize(UINT outputIndex) {
    if (duplication && currentOutputIndex == outputIndex)
      return true;

    if (duplication)
      Cleanup();

    HRESULT hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
                                   0, nullptr, 0, D3D11_SDK_VERSION, &device,
                                   nullptr, &context);
    if (FAILED(hr))
      return false;

    IDXGIDevice *dxgiDevice = nullptr;
    hr = device->QueryInterface(__uuidof(IDXGIDevice), (void **)&dxgiDevice);
    if (FAILED(hr))
      return false;

    IDXGIAdapter *dxgiAdapter = nullptr;
    hr = dxgiDevice->GetParent(__uuidof(IDXGIAdapter), (void **)&dxgiAdapter);
    dxgiDevice->Release();
    if (FAILED(hr))
      return false;

    IDXGIOutput *dxgiOutput = nullptr;
    hr = dxgiAdapter->EnumOutputs(outputIndex, &dxgiOutput);
    dxgiAdapter->Release();
    if (FAILED(hr))
      return false;

    // Prefer DuplicateOutput1 (Win10 1703+) with an explicit BGRA8 format list.
    // On HDR displays the desktop surface is R16G16B16A16_FLOAT (8 bytes/px);
    // the legacy DuplicateOutput hands that straight back and the downstream
    // pipeline — which assumes 4-byte BGRA — produces garbage/black frames.
    // DuplicateOutput1 makes the OS tone-map HDR down to BGRA8 for us. Every
    // Windows build that can enable HDR also has IDXGIOutput5, so the legacy
    // fallback below only ever runs on SDR-only systems where BGRA8 is native.
    IDXGIOutput5 *dxgiOutput5 = nullptr;
    hr = dxgiOutput->QueryInterface(__uuidof(IDXGIOutput5),
                                    (void **)&dxgiOutput5);
    if (SUCCEEDED(hr)) {
      const DXGI_FORMAT supportedFormats[] = {DXGI_FORMAT_B8G8R8A8_UNORM};
      hr = dxgiOutput5->DuplicateOutput1(device, 0, 1, supportedFormats,
                                         &duplication);
      if (SUCCEEDED(hr)) {
        dxgiOutput5->GetDesc(&outputDesc);
        currentOutputIndex = outputIndex;
      }
      dxgiOutput5->Release();
      if (SUCCEEDED(hr)) {
        dxgiOutput->Release();
        return true;
      }
      // fall through to the legacy duplication path
    }

    IDXGIOutput1 *dxgiOutput1 = nullptr;
    hr = dxgiOutput->QueryInterface(__uuidof(IDXGIOutput1),
                                    (void **)&dxgiOutput1);
    dxgiOutput->Release();
    if (FAILED(hr))
      return false;

    hr = dxgiOutput1->DuplicateOutput(device, &duplication);
    if (SUCCEEDED(hr)) {
        dxgiOutput1->GetDesc(&outputDesc);
        currentOutputIndex = outputIndex;
    }
    dxgiOutput1->Release();
    if (FAILED(hr))
      return false;

    return true;
  }

  Napi::Value Capture(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    UINT outputIndex = 0;
    if (info.Length() > 0 && info[0].IsNumber()) {
      outputIndex = info[0].As<Napi::Number>().Uint32Value();
    }

    if (!Initialize(outputIndex)) {
      Napi::Error::New(env, "Failed to initialize DXGI")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    IDXGIResource *desktopResource = nullptr;
    DXGI_OUTDUPL_FRAME_INFO frameInfo;
    // Non-blocking capture
    HRESULT hr = duplication->AcquireNextFrame(0, &frameInfo, &desktopResource);

    if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
      return env.Null();
    }

    if (FAILED(hr)) {
      Cleanup(); // Reset on error
      return env.Null();
    }

    // DXGI wakes for pointer movement even when no desktop pixels changed.
    // The viewer draws the cursor from a separate metadata channel; avoid a
    // full GPU readback, BGRA copy and encode just to move that cursor.
    // Always deliver the first frame after initialization for decoder bootstrap.
    if (hasCapturedFrame && frameInfo.LastPresentTime.QuadPart == 0 &&
        frameInfo.AccumulatedFrames == 0 && frameInfo.TotalMetadataBufferSize == 0) {
      desktopResource->Release();
      duplication->ReleaseFrame();
      return env.Null();
    }

    ID3D11Texture2D *acquireTexture = nullptr;
    hr = desktopResource->QueryInterface(__uuidof(ID3D11Texture2D),
                                         (void **)&acquireTexture);
    desktopResource->Release();
    if (FAILED(hr)) {
      duplication->ReleaseFrame();
      return env.Null();
    }

    D3D11_TEXTURE2D_DESC desc;
    acquireTexture->GetDesc(&desc);

    // Reuse or create staging texture
    if (stagingTexture) {
      D3D11_TEXTURE2D_DESC currentStagingDesc;
      stagingTexture->GetDesc(&currentStagingDesc);
      if (currentStagingDesc.Width != desc.Width ||
          currentStagingDesc.Height != desc.Height) {
        stagingTexture->Release();
        stagingTexture = nullptr;
      }
    }

    if (!stagingTexture) {
      D3D11_TEXTURE2D_DESC stagingDesc = desc;
      stagingDesc.Usage = D3D11_USAGE_STAGING;
      stagingDesc.BindFlags = 0;
      stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
      stagingDesc.MiscFlags = 0;

      hr = device->CreateTexture2D(&stagingDesc, nullptr, &stagingTexture);
      if (FAILED(hr)) {
        acquireTexture->Release();
        duplication->ReleaseFrame();
        return env.Null();
      }
    }

    context->CopyResource(stagingTexture, acquireTexture);
    acquireTexture->Release();
    duplication->ReleaseFrame();

    D3D11_MAPPED_SUBRESOURCE mapped;
    hr = context->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mapped);
    if (FAILED(hr)) {
      return env.Null();
    }

    Napi::Object result = Napi::Object::New(env);
    result.Set("width", desc.Width);
    result.Set("height", desc.Height);

    size_t bufferSize = desc.Width * desc.Height * 4;
    // The stream worker supplies a small ring of exact-sized Buffers. Reusing
    // them avoids allocating and later garbage-collecting 8 MB per 1080p frame
    // (roughly 500 MB/s of allocation churn at 60 fps). Callers that do not
    // provide a buffer retain the original allocation behavior.
    Napi::Buffer<uint8_t> buffer =
        (info.Length() > 1 && info[1].IsBuffer() &&
         info[1].As<Napi::Buffer<uint8_t>>().Length() == bufferSize)
            ? info[1].As<Napi::Buffer<uint8_t>>()
            : Napi::Buffer<uint8_t>::New(env, bufferSize);

    uint8_t *dest = buffer.Data();
    uint8_t *src = (uint8_t *)mapped.pData;
    uint32_t targetPitch = desc.Width * 4;

    if (mapped.RowPitch == targetPitch) {
      memcpy(dest, src, bufferSize);
    } else {
      for (unsigned int y = 0; y < desc.Height; ++y) {
        memcpy(dest + (y * targetPitch), src + (y * mapped.RowPitch),
               targetPitch);
      }
    }

    context->Unmap(stagingTexture, 0);

    // ── Mouse Cursor Compositing ───────────────────────────────────────────
    // Keep the desktop frame cursor-free. The viewer draws one cursor overlay
    // from cursor metadata so movement is smoother and never duplicated.
    // ───────────────────────────────────────────────────────────────────────

    result.Set("data", buffer);
    hasCapturedFrame = true;
    return result;
  }

private:
  void Cleanup() {
    hasCapturedFrame = false;
    if (stagingTexture) {
      stagingTexture->Release();
      stagingTexture = nullptr;
    }
    if (duplication) {
      duplication->Release();
      duplication = nullptr;
    }
    if (context) {
      context->Release();
      context = nullptr;
    }
    if (device) {
      device->Release();
      device = nullptr;
    }
  }

  ID3D11Device *device;
  ID3D11DeviceContext *context;
  IDXGIOutputDuplication *duplication;
  ID3D11Texture2D *stagingTexture;
  DXGI_OUTPUT_DESC outputDesc;
  UINT currentOutputIndex;
  bool hasCapturedFrame;
};

DXGICapture g_capture;

Napi::Value CaptureFrame(const Napi::CallbackInfo& info) {
  return g_capture.Capture(info);
}

// Return the host's current mouse cursor SHAPE as a CSS-cursor name, so the viewer can
// mirror it (I-beam over text, hand over links, resize arrows, etc.). Compares the live
// cursor handle against the standard system cursors; custom cursors fall back to "default".
Napi::Value GetCursorType(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  const char* type = "default";
  CURSORINFO ci; ci.cbSize = sizeof(ci);
  if (GetCursorInfo(&ci) && (ci.flags & CURSOR_SHOWING) && ci.hCursor) {
    HCURSOR h = ci.hCursor;
    if      (h == LoadCursor(nullptr, IDC_IBEAM))       type = "text";
    else if (h == LoadCursor(nullptr, IDC_HAND))        type = "pointer";
    else if (h == LoadCursor(nullptr, IDC_SIZEALL))     type = "move";
    else if (h == LoadCursor(nullptr, IDC_SIZENS))      type = "ns-resize";
    else if (h == LoadCursor(nullptr, IDC_SIZEWE))      type = "ew-resize";
    else if (h == LoadCursor(nullptr, IDC_SIZENWSE))    type = "nwse-resize";
    else if (h == LoadCursor(nullptr, IDC_SIZENESW))    type = "nesw-resize";
    else if (h == LoadCursor(nullptr, IDC_WAIT))        type = "wait";
    else if (h == LoadCursor(nullptr, IDC_APPSTARTING)) type = "progress";
    else if (h == LoadCursor(nullptr, IDC_CROSS))       type = "crosshair";
    else if (h == LoadCursor(nullptr, IDC_NO))          type = "not-allowed";
    else if (h == LoadCursor(nullptr, IDC_HELP))        type = "help";
  }
  return Napi::String::New(env, type);
}

// Raise (or release) the process timer resolution to 1ms. Windows quantizes
// timers to ~15.6ms by default, which makes a 33ms-paced capture loop tick at
// alternating ~31/47ms intervals — the screen gets SAMPLED unevenly while the
// stream's timestamps claim a perfect cadence, and the viewer sees juddery,
// unstable motion no jitter buffer can repair. Media apps (Chromium during
// playback, OBS, Discord) request 1ms while capturing for exactly this reason.
static bool g_highResTimersActive = false;
Napi::Value SetHighResTimers(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  bool enable = true;
  if (info.Length() > 0 && info[0].IsBoolean()) enable = info[0].As<Napi::Boolean>().Value();
  if (enable && !g_highResTimersActive) {
    g_highResTimersActive = (timeBeginPeriod(1) == TIMERR_NOERROR);
  } else if (!enable && g_highResTimersActive) {
    timeEndPeriod(1);
    g_highResTimersActive = false;
  }
  return Napi::Boolean::New(env, g_highResTimersActive);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "captureFrame"),
              Napi::Function::New(env, CaptureFrame));
  exports.Set(Napi::String::New(env, "getCursorType"),
              Napi::Function::New(env, GetCursorType));
  exports.Set(Napi::String::New(env, "setHighResTimers"),
              Napi::Function::New(env, SetHighResTimers));
  return exports;
}

NODE_API_MODULE(capture, Init)
