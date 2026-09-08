package com.all18.app.bridge

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.webkit.JavascriptInterface
import android.widget.Toast
import com.all18.app.MainActivity

class All18JsBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun getAppVersion(): String = "1.3.1"

    @JavascriptInterface
    fun isMultiInstanceSupported(): Boolean = true

    @JavascriptInterface
    fun openNewInstance(url: String) {
        activity.runOnUiThread {
            try {
                val fullUrl = if (url.startsWith("http://") || url.startsWith("https://")) {
                    url
                } else {
                    "https://appassets.androidplatform.net/assets/web/" + url.removePrefix("/")
                }
                val intent = Intent(activity, MainActivity::class.java).apply {
                    action = Intent.ACTION_VIEW
                    data = Uri.parse(fullUrl)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_MULTIPLE_TASK or
                            Intent.FLAG_ACTIVITY_NEW_DOCUMENT
                }
                activity.startActivity(intent)
                showToast("Nueva instancia All18 iniciada")
            } catch (e: Exception) {
                showToast("Error al abrir instancia: ${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun enterPipMode(): Boolean {
        var success = false
        activity.runOnUiThread {
            success = activity.enterPipMode()
            if (!success) {
                showToast("Modo PiP no disponible en este dispositivo")
            }
        }
        return success
    }

    @JavascriptInterface
    fun isPipSupported(): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                activity.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_PICTURE_IN_PICTURE)
    }

    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        activity.runOnUiThread {
            try {
                @Suppress("DEPRECATION")
                val v = activity.getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
                v?.vibrate(durationMs.coerceIn(10L, 500L))
            } catch (e: Exception) {}
        }
    }

    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun shareLink(title: String, url: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    putExtra(Intent.EXTRA_TEXT, "$title\n$url")
                }
                activity.startActivity(Intent.createChooser(intent, "Compartir video"))
            } catch (e: Exception) {
                showToast("Error al compartir: ${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun downloadMedia(url: String, filename: String) {
        // Enforce user rule: abort file://, about:, data:
        if (url.startsWith("file://", ignoreCase = true) ||
            url.startsWith("about:", ignoreCase = true) ||
            url.startsWith("data:", ignoreCase = true)
        ) {
            showToast("Descarga abortada: esquema no permitido")
            return
        }

        activity.runOnUiThread {
            try {
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setTitle(filename.ifEmpty { "Video_All18.mp4" })
                    setDescription("Descargando contenido All18")
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        filename.ifEmpty { "All18_${System.currentTimeMillis()}.mp4" }
                    )
                    setAllowedOverMetered(true)
                    setAllowedOverRoaming(true)
                }

                val dm = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(activity, "Descarga iniciada: guardando en Descargas", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                Toast.makeText(activity, "Error al iniciar descarga: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun toggleOrientation(landscape: Boolean) {
        activity.setOrientation(landscape)
    }

    @JavascriptInterface
    fun copyToClipboard(text: String) {
        activity.runOnUiThread {
            try {
                val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                val clip = android.content.ClipData.newPlainText("All18", text)
                clipboard.setPrimaryClip(clip)
                showToast("Copiado al portapapeles")
            } catch (e: Exception) {
                showToast("Error al copiar")
            }
        }
    }

    @JavascriptInterface
    fun exitApp() {
        activity.runOnUiThread {
            activity.finish()
        }
    }
}
