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

class SampleUploader {
    private static var imageContext = CIContext(options: nil)

    @Atomic private var isReady = false

    private var connection: SocketConnection

    private var dataToSend: Data?
    private var byteIndex = 0
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
        isReady = false

        dataToSend = prepare(sample: buffer)
        byteIndex = 0
        serialQueue.async { self.sendDataChunk() }
        return true
    }

    // MARK: - Private

    private func setupConnection() {
        connection.didOpen = { [weak self] in
            self?.isReady = true
        }
        connection.didClose = { [weak self] _ in
            self?.isReady = false
        }
    }

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
                dataToSend = nil
                byteIndex = 0
                isReady = true
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

        let scaleFactor = 1.0
        let width = CVPixelBufferGetWidth(imageBuffer) / Int(scaleFactor)
        let height = CVPixelBufferGetHeight(imageBuffer) / Int(scaleFactor)
        // Annotated rather than inferred: CMGetAttachment is generic over its return type
        // and cannot resolve it from a trailing member lookup alone.
        let orientationValue: NSNumber? = CMGetAttachment(
            buffer,
            key: RPVideoSampleOrientationKey as CFString,
            attachmentModeOut: nil
        )
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
            options: [CIImageRepresentationOption(rawValue: kCGImageDestinationLossyCompressionQuality as String): 1.0]
        )
    }
}
