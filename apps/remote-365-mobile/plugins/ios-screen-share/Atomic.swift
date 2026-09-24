//
//  Atomic.swift
//  Remote 365 broadcast upload extension
//
//  Minimal thread-safe property wrapper. The uploader is driven from two queues
//  (ReplayKit's sample callback and the socket's RunLoop thread), so the
//  "is a frame already in flight" flag must not be read and written racily —
//  dropping that guard produces interleaved writes and a corrupted frame stream.
//

import Foundation

@propertyWrapper
final class Atomic<Value> {
    private let queue = DispatchQueue(label: "ai.remote365.broadcast.atomic")
    private var value: Value

    init(wrappedValue: Value) {
        self.value = wrappedValue
    }

    var wrappedValue: Value {
        get { queue.sync { value } }
        set { queue.sync { value = newValue } }
    }

    /// Read-modify-write as one atomic step. `wrappedValue += 1` would otherwise be
    /// two separate sync blocks with a gap in between.
    func mutate(_ mutation: (inout Value) -> Void) {
        queue.sync { mutation(&value) }
    }
}
