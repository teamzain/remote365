//
//  SampleUploader.swift
//  Remote 365 broadcast upload extension
//
//  Encodes ReplayKit frames and writes them over the socket in the exact framing
//  react-native-webrtc's ScreenCapturer expects (see its `unwrapMessage:`):
//
//      CFHTTPMessage
//        Content-Length     : body byte count
//        Buffer-Width       : pixel width   -> CVPixelBufferCreate(width, ...)
//        Buffer-Height      : pixel height
//        Buffer-Orientation : CGImagePropertyOrientation raw value
//        <body>             : JPEG data, decoded app-side via CIImage
//
//  The header names are load-bearing: the app reads them verbatim, and a mismatch
//  yields a 0x0 pixel buffer and a black screen share rather than an error.
//

import Foundation
import CFNetwork
import ReplayKit
import CoreImage
import VideoToolbox

private let kMaxReadLength = 10 * 1024
/// At most ~15 frames a second reach the encoder.
private let kMinFrameInterval: TimeInterval = 1.0 / 15.0
/// Frames are halved in each dimension before encoding (an iPhone screen is ~1200x2600
/// pixels; a full-size JPEG of each frame is too much for the extension's memory limit).
private let kScaleFactor = 2.0
/// JPEG quality. Text stays sharp at this level at a fraction of the size of 1.0.
private let kJpegQuality = 0.8

class SampleUploader {
    private static var imageContext = CIContext(options: nil)

    @Atomic private var isReady = false

    private var connection: SocketConnection

    private var dataToSend: Data?
    private var byteIndex = 0
    private var lastFrameTime: TimeInterval = 0
    private let serialQueue = DispatchQueue(label: "ai.remote365.broadcast.uploader")

    init(connection: SocketConnection) {
        self.connection = connection
        setupConnection()
    }

    @discardableResult
    func send(sample buffer: CMSampleBuffer) -> Bool {
        // Drop frames while one is still in flight. Screen capture is far faster than the
        // socket on a busy device, and queueing would add unbounded latency — a stale
        // frame is worse than a skipped one for a live share.
        guard isReady else { return false }

        // ReplayKit delivers up to 60 frames a second. Encoding every one of them as JPEG
        // would exhaust the extension's ~50 MB limit, so cap the rate.
        let now = ProcessInfo.processInfo.systemUptime
        guard now - lastFrameTime >= kMinFrameInterval else { return false }
        lastFrameTime = now

        isReady = false
        // A failed encode writes nothing, so no "space available" event would ever make the
        // uploader ready again: hand the turn back here.
        guard let data = prepare(sample: buffer) else {
            isReady = true
            return false
        }

        serialQueue.async {
            self.dataToSend = data
            self.byteIndex = 0
            self.sendDataChunk()
        }
        return true
    }

    // MARK: - Private

    private func setupConnection() {
        connection.didOpen = { [weak self] in
            self?.isReady = true
        }
        // A frame is hundreds of kilobytes and one write takes ~10 KB, so the rest of the
        // frame goes out here, one chunk per "space available" event. The uploader is ready
        // for the next frame only once nothing is left to send.
        // (didClose belongs to SampleHandler, which ends the broadcast; do not set it here.)
        connection.streamHasSpaceAvailable = { [weak self] in
            self?.serialQueue.async {
                guard let self = self else { return }
                self.isReady = !self.sendDataChunk()
            }
        }
    }

    /// Writes the next chunk of the frame in flight. Returns false when there is nothing
    /// (left) to send, true while a frame is still going out.
    @discardableResult
    private func sendDataChunk() -> Bool {
        guard let data = dataToSend else { return false }

        var bytesLeft = data.count - byteIndex
        var length = bytesLeft > kMaxReadLength ? kMaxReadLength : bytesLeft

        length = data[byteIndex..<(byteIndex + length)].withUnsafeBytes {
            guard let pointer = $0.bindMemory(to: UInt8.self).baseAddress else { return 0 }
            return connection.writeToStream(buffer: pointer, maxLength: length)
        }

        if length > 0 {
            byteIndex += length
            bytesLeft -= length
            if bytesLeft == 0 {
                // Done. The next "space available" event finds nothing to send and marks
                // the uploader ready.
                dataToSend = nil
                byteIndex = 0
            }
        } else {
            NSLog("[Remote365Broadcast] writeBufferToStream failure")
        }
        return true
    }

    private func prepare(sample buffer: CMSampleBuffer) -> Data? {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(buffer) else {
            NSLog("[Remote365Broadcast] image buffer not available")
            return nil
        }

        CVPixelBufferLockBaseAddress(imageBuffer, .readOnly)

        let scaleFactor = kScaleFactor
        let width = CVPixelBufferGetWidth(imageBuffer) / Int(scaleFactor)
        let height = CVPixelBufferGetHeight(imageBuffer) / Int(scaleFactor)
        // CMGetAttachment returns CFTypeRef? (it is not generic), so cast the result.
        let orientationValue = CMGetAttachment(
            buffer,
            key: RPVideoSampleOrientationKey as CFString,
            attachmentModeOut: nil
        ) as? NSNumber
        let orientation = orientationValue?.uintValue ?? 0

        let scaleTransform = CGAffineTransform(scaleX: CGFloat(1.0 / scaleFactor), y: CGFloat(1.0 / scaleFactor))
        let bufferData = jpegData(from: imageBuffer, scale: scaleTransform)

        CVPixelBufferUnlockBaseAddress(imageBuffer, .readOnly)

        guard let messageData = bufferData else {
            NSLog("[Remote365Broadcast] corrupted image buffer")
            return nil
        }

        let httpResponse = CFHTTPMessageCreateResponse(kCFAllocatorDefault, 200, nil, kCFHTTPVersion1_1).takeRetainedValue()
        CFHTTPMessageSetHeaderFieldValue(httpResponse, "Content-Length" as CFString, String(messageData.count) as CFString)
        CFHTTPMessageSetHeaderFieldValue(httpResponse, "Buffer-Width" as CFString, String(width) as CFString)
        CFHTTPMessageSetHeaderFieldValue(httpResponse, "Buffer-Height" as CFString, String(height) as CFString)
        CFHTTPMessageSetHeaderFieldValue(httpResponse, "Buffer-Orientation" as CFString, String(orientation) as CFString)
        CFHTTPMessageSetBody(httpResponse, messageData as CFData)

        let serializedMessage = CFHTTPMessageCopySerializedMessage(httpResponse)?.takeRetainedValue() as Data?
        return serializedMessage
    }

    private func jpegData(from pixelBuffer: CVPixelBuffer, scale scaleTransform: CGAffineTransform) -> Data? {
        let image = CIImage(cvPixelBuffer: pixelBuffer).transformed(by: scaleTransform)
        guard let colorSpace = image.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB) else { return nil }
        return SampleUploader.imageContext.jpegRepresentation(
            of: image,
            colorSpace: colorSpace,
            options: [CIImageRepresentationOption(rawValue: kCGImageDestinationLossyCompressionQuality as String): kJpegQuality]
        )
    }
}
