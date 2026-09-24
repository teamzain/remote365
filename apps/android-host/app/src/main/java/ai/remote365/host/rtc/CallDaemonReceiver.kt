package ai.remote365.host.rtc

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Exported handoff is untrusted until the helper answers a fresh authentication challenge. */
class CallDaemonReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "ai.remote365.host.CALLAUDIO_BINDER") return
        val binder = intent.extras?.getBinder("binder") ?: return
        if (!checking.compareAndSet(false, true)) return
        val pending = goAsync()
        executor.execute {
            try { CallDaemonClient.onBinderReceived(context.applicationContext, binder) }
            finally { checking.set(false); pending.finish() }
        }
    }
    companion object {
        private val checking = AtomicBoolean(false)
        private val executor = Executors.newSingleThreadExecutor()
    }
}
