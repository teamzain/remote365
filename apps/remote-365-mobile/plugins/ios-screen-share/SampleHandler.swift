//
//  SampleHandler.swift
//  Remote 365 broadcast upload extension
//
//  ReplayKit entry point. iOS runs this in its OWN process when the user starts a
//  broadcast from the system picker — it cannot reach the app directly, so frames go
//  over a unix socket in the shared App Group container (see SocketConnection).
//
//  The extension is memory-capped by iOS (~50 MB); exceeding it kills the broadcast
//  mid-session. That is why frames are JPEG-encoded and dropped under backpressure
//  rather than buffered.
//

import Foundation
import ReplayKit

class SampleHandler: RPBroadcastSampleHandler {
    private var clientConnection: SocketConnection?
    private var uploader: SampleUploader?

    /// Must match `RTCAppGroupIdentifier` in the MAIN APP's Info.plist — the app derives
    /// the socket path from the same group container. The config plugin writes both.
    private var appGroupIdentifier: String? {
        Bundle.main.object(forInfoDictionaryKey: "RTCAppGroupIdentifier") as? String
    }

    private var socketFilePath: String? {
        guard let group = appGroupIdentifier,
              let sharedContainer = FileManager.default
                  .containerURL(forSecurityApplicationGroupIdentifier: group)
        else { return nil }
        // File name fixed by react-native-webrtc (kRTCScreensharingSocketFD).
        return sharedContainer.appendingPathComponent("rtc_SSFD").path
    }

    override init() {
        super.init()
        guard let path = socketFilePath, let connection = SocketConnection(filePath: path) else {
            NSLog("[Remote365Broadcast] could not build socket connection — App Group misconfigured?")
            return
        }
        clientConnection = connection
        setupConnection()
        uploader = SampleUploader(connection: connection)
    }

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        DarwinNotificationCenter.shared.postNotification(.broadcastStarted)
        if clientConnection?.open() != true {
            // The app is not listening: it is not running, or the App Group is wrong.
            // Fail loudly here — otherwise the user sees a broadcast that records nothing.
            finishBroadcastWithError(NSError(
                domain: "ai.remote365.broadcast",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "Open Remote 365 and start the screen share from inside the app."]
            ))
        }
    }

    override func broadcastPaused() {}

    override func broadcastResumed() {}

    override func broadcastFinished() {
        DarwinNotificationCenter.shared.postNotification(.broadcastStopped)
        clientConnection?.close()
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        switch sampleBufferType {
        case .video:
            uploader?.send(sample: sampleBuffer)
        default:
            // App and mic audio travel on the WebRTC audio track already captured by the
            // main app, so the extension deliberately ignores them.
            break
        }
    }

    // MARK: - Private

    private func setupConnection() {
        clientConnection?.didClose = { [weak self] error in
            NSLog("[Remote365Broadcast] client connection closed")
            if let error = error {
                self?.finishBroadcastWithError(error)
            } else {
                self?.finishBroadcastWithError(NSError(
                    domain: "ai.remote365.broadcast",
                    code: 0,
                    userInfo: [NSLocalizedDescriptionKey: "Screen sharing ended."]
                ))
            }
        }
    }
}
