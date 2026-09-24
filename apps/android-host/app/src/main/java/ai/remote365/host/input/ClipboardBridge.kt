package ai.remote365.host.input

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.concurrent.atomic.AtomicLong

/**
 * Two-way clipboard sync over the control channel.
 *
 * Android 10+ only lets an app READ the clipboard while it holds focus, which a background
 * host never does — so `addPrimaryClipChangedListener` fires but `primaryClip` comes back
 * empty. The accessibility service is the way around it: a service with
 * canRetrieveWindowContent can read the clip, so all reads go through the a11y context.
 */
class ClipboardBridge(
    private val context: Context,
    private val send: (String) -> Unit,
) {

    private val handler = Handler(Looper.getMainLooper())
    private val idCounter = AtomicLong(0)

    private var lastHostText = ""
    private var lastRemoteText = ""
    private var polling = false

    private val chunks = mutableMapOf<String, Chunked>()

    private class Chunked(val total: Int) {
        val parts = sortedMapOf<Int, String>()
    }

    private val clipboard: ClipboardManager?
        get() = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager

    fun start() {
        if (polling) return
        polling = true
        lastHostText = readClipboard()
        lastRemoteText = lastHostText
        Log.i(TAG, "clipboard sync started (seed=${lastHostText.length} chars)")
        handler.postDelayed(pollRunnable, POLL_INTERVAL_MS)
    }

    fun stop() {
        polling = false
        handler.removeCallbacks(pollRunnable)
        chunks.clear()
    }

    private val pollRunnable = object : Runnable {
        override fun run() {
            if (!polling) return
            // Never poll mid-drag: reading the clip walks the accessibility tree, and that
            // contends with the gesture dispatch that is streaming the drag.
            if (HostAccessibilityService.instance?.isDragging() != true) {
                publishIfChanged(readClipboard())
            }
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    private fun readClipboard(): String {
        // 1. The active IME can read the clipboard on Android 10+; a background service cannot.
        HostImeService.instance?.readClipboard()?.takeIf { it.isNotEmpty() }?.let { return it }
        // 2. Direct read — works only while we happen to be foreground.
        runCatching {
            val clip = clipboard?.primaryClip
            if (clip != null && clip.itemCount > 0) {
                clip.getItemAt(0).coerceToText(context)?.toString().orEmpty()
            } else {
                ""
            }
        }.getOrDefault("").takeIf { it.isNotEmpty() }?.let { return it }
        // 3. Fall back to the last text the user SELECTED on the phone. When the OS refuses the
        //    clipboard entirely, the selection is the only signal of what they meant to copy.
        return HostAccessibilityService.instance?.lastSelectedText.orEmpty()
    }

    private fun publishIfChanged(text: String) {
        if (text.isEmpty()) return
        // Guard against echo: if this is the value the viewer just pushed to us, re-sending it
        // would clobber a fresher clipboard on the desktop side.
        if (text == lastHostText) return
        Log.i(TAG, "phone clipboard changed -> publishing ${text.length} chars")
        lastHostText = text
        if (text == lastRemoteText) {
            Log.i(TAG, "suppressed: same as value viewer pushed")
            return
        }
        sendClipboard(text)
    }

    private fun sendClipboard(text: String) {
        Log.i(TAG, "sending clipboard-sync to viewer (${text.length} chars)")
        val id = "${idCounter.incrementAndGet()}-host"
        if (text.length <= CHUNK_SIZE) {
            // Type 'clipboard' satisfies BOTH viewers: the web viewer only acts on
            // 'clipboard' (SessionViewer.tsx), while the desktop viewer accepts
            // 'clipboard-sync' OR 'clipboard' (App.tsx). Sending 'clipboard-sync' alone was
            // the bug — the web viewer silently dropped every message. Sending both would
            // make the desktop apply each copy twice, so send just the one they share.
            send(
                buildJsonObject {
                    put("type", "clipboard")
                    put("id", id)
                    put("origin", "mobile")
                    put("text", text)
                }.toString(),
            )
            return
        }
        val total = (text.length + CHUNK_SIZE - 1) / CHUNK_SIZE
        for (index in 0 until total) {
            val slice = text.substring(
                index * CHUNK_SIZE,
                minOf((index + 1) * CHUNK_SIZE, text.length),
            )
            send(
                buildJsonObject {
                    put("type", "clipboard-chunk")
                    put("id", id)
                    put("origin", "mobile")
                    put("chunkIndex", index)
                    put("totalChunks", total)
                    put("text", slice)
                }.toString(),
            )
        }
    }

    /** @return true if the message was a clipboard message and has been consumed. */
    fun handle(msg: JsonObject): Boolean {
        when (msg.str("type")) {
            "clipboard", "clipboard-sync" -> {
                if (msg.str("origin") == "mobile") return true // our own echo
                msg.str("text")?.let { applyRemote(it) }
                return true
            }

            "clipboard-chunk" -> {
                val id = msg.str("id") ?: return true
                if (msg.str("origin") == "mobile") return true
                val total = msg.str("totalChunks")?.toIntOrNull() ?: return true
                val index = msg.str("chunkIndex")?.toIntOrNull() ?: return true
                val text = msg.str("text").orEmpty()
                val transfer = chunks.getOrPut(id) { Chunked(total) }
                transfer.parts[index] = text
                if (transfer.parts.size >= transfer.total) {
                    chunks.remove(id)
                    applyRemote(transfer.parts.values.joinToString(""))
                }
                return true
            }
        }
        return false
    }

    private fun applyRemote(text: String) {
        lastRemoteText = text
        lastHostText = text
        runCatching {
            clipboard?.setPrimaryClip(ClipData.newPlainText("Remote 365", text))
        }.onFailure { Log.w(TAG, "setPrimaryClip failed: ${it.message}") }
    }

    private fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.content

    private companion object {
        const val TAG = "ClipboardBridge"
        const val CHUNK_SIZE = 32 * 1024
        const val POLL_INTERVAL_MS = 1_200L
    }
}
