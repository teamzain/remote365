//
//  DarwinNotificationCenter.swift
//  Remote 365 broadcast upload extension
//
//  The broadcast extension and the app are separate processes, so NSNotificationCenter
//  cannot reach across. Darwin notifications are the supported cross-process signal.
//
//  Used so the app learns the broadcast has finished even when the user stops it from
//  the system UI (Control Centre / status bar) rather than from inside the app — without
//  this the app keeps a dead screen track attached and the viewer sees a frozen frame.
//

import Foundation

public enum DarwinNotification: String {
    case broadcastStarted = "ai.remote365.broadcastStarted"
    case broadcastStopped = "ai.remote365.broadcastStopped"
}

public final class DarwinNotificationCenter {
    public static let shared = DarwinNotificationCenter()

    private let center = CFNotificationCenterGetDarwinNotifyCenter()

    private init() {}

    public func postNotification(_ name: DarwinNotification) {
        CFNotificationCenterPostNotification(
            center,
            CFNotificationName(rawValue: name.rawValue as CFString),
            nil,
            nil,
            true
        )
    }
}
