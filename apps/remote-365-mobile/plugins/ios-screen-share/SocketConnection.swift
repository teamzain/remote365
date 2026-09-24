//
//  SocketConnection.swift
//  Remote 365 broadcast upload extension
//
//  Extension-side half of the screen-share transport.
//
//  react-native-webrtc's ScreenCaptureController (app side) creates a unix domain socket
//  named `rtc_SSFD` inside the shared App Group container and LISTENS on it; this class
//  is the client that CONNECTS to it. If the App Group is missing or its identifier is
//  not published as `RTCAppGroupIdentifier` in the app's Info.plist, the app never opens
//  the socket, `connect()` here fails, and screen share silently produces no frames.
//

import Foundation

class SocketConnection: NSObject {
    private let filePath: String
    private var socketHandle: Int32 = -1
    private var address: sockaddr_un?

    private var inputStream: InputStream?
    private var outputStream: OutputStream?

    private var streamQueue = DispatchQueue(label: "ai.remote365.broadcast.socket")
    private var networkThread: Thread?

    /// Called when either stream errors or closes, so the handler can finish the broadcast.
    var didClose: ((Error?) -> Void)?
    /// Raised when the socket can accept more bytes — the uploader waits on this for backpressure.
    var didOpen: (() -> Void)?

    init?(filePath path: String) {
        filePath = path
        socketHandle = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        super.init()

        guard socketHandle != -1 else {
            NSLog("[Remote365Broadcast] failure: socket unavailable")
            return nil
        }
        guard setupAddress() else { return nil }
    }

    func open() -> Bool {
        NSLog("[Remote365Broadcast] connecting to %@", filePath)
        guard FileManager.default.fileExists(atPath: filePath) else {
            // The app has not opened its listener. Almost always a missing App Group or a
            // missing RTCAppGroupIdentifier — not a transient condition.
            NSLog("[Remote365Broadcast] failure: socket file missing — is the App Group configured?")
            return false
        }
        guard let addr = address else { return false }

        let status = withUnsafePointer(to: addr) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(socketHandle, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard status == noErr else {
            NSLog("[Remote365Broadcast] failure: connect errno %d", errno)
            return false
        }

        var readStream: Unmanaged<CFReadStream>?
        var writeStream: Unmanaged<CFWriteStream>?
        CFStreamCreatePairWithSocket(kCFAllocatorDefault, socketHandle, &readStream, &writeStream)

        inputStream = readStream?.takeRetainedValue()
        outputStream = writeStream?.takeRetainedValue()
        inputStream?.delegate = self
        outputStream?.delegate = self

        // The streams need a live RunLoop. The ReplayKit sample callback runs on a queue
        // with no RunLoop of its own, so the streams get a dedicated thread.
        let thread = Thread(target: self, selector: #selector(scheduleStreams), object: nil)
        thread.name = "ai.remote365.broadcast.socket"
        thread.start()
        networkThread = thread
        return true
    }

    func close() {
        guard let thread = networkThread else { return }
        perform(#selector(unscheduleStreams), on: thread, with: nil, waitUntilDone: true)
        inputStream?.delegate = nil
        outputStream?.delegate = nil
        inputStream = nil
        outputStream = nil
        networkThread = nil
        if socketHandle != -1 {
            Darwin.close(socketHandle)
            socketHandle = -1
        }
    }

    /// Writes up to `length` bytes; returns how many were actually accepted so the caller
    /// can resume from the right offset when the socket applies backpressure.
    func writeToStream(buffer: UnsafePointer<UInt8>, maxLength length: Int) -> Int {
        guard let stream = outputStream, stream.hasSpaceAvailable else { return 0 }
        return stream.write(buffer, maxLength: length)
    }

    // MARK: - Private

    private func setupAddress() -> Bool {
        var addr = sockaddr_un()
        guard filePath.utf8.count < MemoryLayout.size(ofValue: addr.sun_path) else {
            NSLog("[Remote365Broadcast] failure: socket path too long")
            return false
        }
        addr.sun_family = sa_family_t(AF_UNIX)
        _ = withUnsafeMutablePointer(to: &addr.sun_path.0) { pointer in
            filePath.withCString { strncpy(pointer, $0, filePath.utf8.count) }
        }
        address = addr
        return true
    }

    @objc private func scheduleStreams() {
        inputStream?.schedule(in: .current, forMode: .common)
        outputStream?.schedule(in: .current, forMode: .common)
        inputStream?.open()
        outputStream?.open()

        var isRunning = true
        while isRunning && !Thread.current.isCancelled {
            isRunning = RunLoop.current.run(mode: .default, before: .distantFuture)
        }
        Thread.exit()
    }

    @objc private func unscheduleStreams() {
        inputStream?.remove(from: .current, forMode: .common)
        outputStream?.remove(from: .current, forMode: .common)
        inputStream?.close()
        outputStream?.close()
    }
}

extension SocketConnection: StreamDelegate {
    func stream(_ aStream: Stream, handle eventCode: Stream.Event) {
        switch eventCode {
        case .openCompleted:
            NSLog("[Remote365Broadcast] stream open")
        case .hasSpaceAvailable:
            didOpen?()
        case .errorOccurred:
            NSLog("[Remote365Broadcast] stream error: %@", aStream.streamError?.localizedDescription ?? "unknown")
            didClose?(aStream.streamError)
        case .endEncountered:
            // The app closed its end — the session finished or the app was killed.
            NSLog("[Remote365Broadcast] stream ended")
            didClose?(nil)
        default:
            break
        }
    }
}
