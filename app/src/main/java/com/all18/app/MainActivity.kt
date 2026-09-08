package com.all18.app

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import com.all18.app.api.All18ApiInterceptor
import com.all18.app.bridge.All18JsBridge
import com.all18.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var apiInterceptor: All18ApiInterceptor
    private lateinit var assetLoader: WebViewAssetLoader

    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var originalOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    private var backPressedTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // AMOLED Pure Black bars
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiInterceptor = All18ApiInterceptor(this)

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        setupWebView()
        setupBackNavigation()

        // Load Tube index or deep linked target URL
        val targetUrl = intent?.dataString ?: intent?.getStringExtra("target_url") ?: "https://appassets.androidplatform.net/assets/web/index.html"
        binding.webView.loadUrl(targetUrl)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = intent?.dataString ?: intent?.getStringExtra("target_url")
        if (!url.isNullOrEmpty()) {
            binding.webView.loadUrl(url)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webView = binding.webView
        val settings = webView.settings

        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.javaScriptCanOpenWindowsAutomatically = true
        settings.safeBrowsingEnabled = false

        // Enable third party cookies for video embeds (Pornhub, RedGifs, RedTube)
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // Compliance with User Global Rules
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true

        // Smooth HTML5 video playback without user gesture restrictions
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // Custom User Agent (v1.2.0 Ultra Boost)
        val defaultUa = settings.userAgentString
        settings.userAgentString = "$defaultUa All18App/1.2.0"
        settings.setSupportMultipleWindows(true)

        // Hardware acceleration
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.setBackgroundColor(Color.BLACK)

        // JavaScript Interface
        webView.addJavascriptInterface(All18JsBridge(this), "AndroidApp")

        // Safe DownloadListener (Rule compliance: abort file://, about:, data:)
        webView.setDownloadListener(DownloadListener { url, _, _, _, _ ->
            if (url.startsWith("file://", ignoreCase = true) ||
                url.startsWith("about:", ignoreCase = true) ||
                url.startsWith("data:", ignoreCase = true)
            ) {
                Toast.makeText(this@MainActivity, "Descarga abortada por seguridad", Toast.LENGTH_SHORT).show()
                return@DownloadListener
            }

            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "No se puede descargar el enlace", Toast.LENGTH_SHORT).show()
            }
        })

        // WebChromeClient: Fullscreen video & progress bar
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    binding.progressBar.visibility = View.VISIBLE
                    binding.progressBar.progress = newProgress
                } else {
                    binding.progressBar.visibility = View.GONE
                }
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    callback?.onCustomViewHidden()
                    return
                }

                customView = view
                customViewCallback = callback
                originalOrientation = requestedOrientation

                binding.webView.visibility = View.GONE
                binding.customViewContainer.visibility = View.VISIBLE
                binding.customViewContainer.addView(
                    view,
                    FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                )

                hideSystemUI()
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            }

            override fun onHideCustomView() {
                if (customView == null) return

                binding.customViewContainer.removeView(customView)
                customView = null
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null

                binding.customViewContainer.visibility = View.GONE
                binding.webView.visibility = View.VISIBLE

                showSystemUI()
                requestedOrientation = originalOrientation
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
                val tempWebView = WebView(this@MainActivity)
                tempWebView.settings.javaScriptEnabled = true
                tempWebView.settings.domStorageEnabled = true
                tempWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                        val target = request?.url?.toString() ?: return false
                        binding.webView.loadUrl(target)
                        return true
                    }
                }
                transport.webView = tempWebView
                resultMsg.sendToTarget()
                return true
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d("All18Console", "[${consoleMessage?.messageLevel()}] ${consoleMessage?.message()} (${consoleMessage?.sourceId()}:${consoleMessage?.lineNumber()})")
                return super.onConsoleMessage(consoleMessage)
            }
        }

        // WebViewClient: Intercept API and handle navigation
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                if (request == null) return null

                // 1. Intercept API & RedGifs CORS proxy
                val apiResponse = apiInterceptor.shouldIntercept(request)
                if (apiResponse != null) {
                    return apiResponse
                }

                // 2. Intercept local asset loading
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                if (request == null) return false

                // NEVER hijack iframe navigations! Allow all video embeds to load inside WebView!
                if (!request.isForMainFrame) {
                    return false
                }

                val url = request.url.toString()

                // Stay inside WebView for internal pages and all media embed providers
                if (url.startsWith("https://appassets.androidplatform.net") ||
                    url.startsWith("file:///android_asset") ||
                    url.contains("/embed/") ||
                    url.contains("/embedframe/") ||
                    url.contains("/ifr/") ||
                    url.contains("pornhub.com") ||
                    url.contains("xvideos.com") ||
                    url.contains("xnxx.com") ||
                    url.contains("redtube.com") ||
                    url.contains("youporn.com") ||
                    url.contains("spankbang.com") ||
                    url.contains("redgifs.com") ||
                    url.endsWith(".html") ||
                    url.contains(".html?")
                ) {
                    return false
                }

                // External intents for communication schemes
                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("tg:") || url.startsWith("whatsapp:")) {
                    return try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        true
                    } catch (e: Exception) {
                        false
                    }
                }

                // Allow all standard web navigations within WebView
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)

                // Automation: Auto-bypass Age Gate seamlessly
                val autoBypassScript = """
                    (function() {
                        try {
                            localStorage.setItem('all18_age_verified', 'true');
                            const modal = document.getElementById('welcomeModal');
                            if (modal) {
                                modal.style.display = 'none';
                                modal.remove();
                            }
                        } catch(e) {}
                    })();
                """.trimIndent()
                view?.evaluateJavascript(autoBypassScript, null)
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: android.webkit.SslErrorHandler?,
                error: android.net.http.SslError?
            ) {
                // Ensure edge media/video CDNs load smoothly without silent blocks
                handler?.proceed()
            }
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) {
                    binding.webView.webChromeClient?.onHideCustomView()
                    return
                }

                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                    return
                }

                // Double tap to exit
                val currentTime = System.currentTimeMillis()
                if (currentTime - backPressedTime < 2000) {
                    finish()
                } else {
                    backPressedTime = currentTime
                    Toast.makeText(this@MainActivity, "Presiona de nuevo para salir", Toast.LENGTH_SHORT).show()
                }
            }
        })
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        }
    }

    private fun showSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.show(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        }
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
    }

    override fun onPause() {
        binding.webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        binding.webView.destroy()
        super.onDestroy()
    }
}
