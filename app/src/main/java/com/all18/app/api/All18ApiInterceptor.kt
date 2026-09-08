package com.all18.app.api

import android.content.Context
import android.net.Uri
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern
import android.text.Html

class All18ApiInterceptor(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .followRedirects(true)
        .connectionPool(okhttp3.ConnectionPool(32, 5, TimeUnit.MINUTES))
        .build()

    private val mediaClient = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .connectionPool(okhttp3.ConnectionPool(32, 5, TimeUnit.MINUTES))
        .build()

    private var redGifsToken: String? = null
    private var redGifsExpires: Long = 0L

    fun shouldIntercept(request: WebResourceRequest): WebResourceResponse? {
        val uri = request.url
        val host = uri.host ?: ""
        val path = uri.path ?: ""

        // 0. AdBlock Shield: Intercept and neutralize ad networks, trackers and popunder scripts
        if (isAdRequest(uri)) {
            return WebResourceResponse(
                "text/plain",
                "UTF-8",
                200,
                "OK",
                mapOf("Access-Control-Allow-Origin" to "*"),
                ByteArrayInputStream(ByteArray(0))
            )
        }

        // 1. Intercept RedGifs: Preflight OPTIONS, API calls, and Media to bypass CORS & 403 Hotlink Protection
        if (host.contains("redgifs.com")) {
            if (request.method.equals("OPTIONS", ignoreCase = true)) {
                return createCorsOptionsResponse()
            }
            if (path.contains("/v2/")) {
                return proxyRedGifsRequest(request)
            }
            if (host.contains("media.") || path.endsWith(".mp4") || path.endsWith(".webm") || path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".png") || path.endsWith(".webp")) {
                return proxyRedGifsMedia(request)
            }
        }

        // 2. Intercept api.php calls
        if (path.endsWith("api.php") || path.contains("/api.php")) {
            return try {
                handleApiRequest(uri)
            } catch (e: Exception) {
                Log.e("All18Api", "Error handling API request: ${e.message}", e)
                createJsonResponse("{\"status\":\"error\",\"message\":\"${e.message}\",\"data\":[]}")
            }
        }


        return null
    }

    private fun proxyRedGifsRequest(request: WebResourceRequest): WebResourceResponse? {
        return try {
            val url = request.url.toString()
            val reqBuilder = Request.Builder().url(url)
            for ((key, value) in request.requestHeaders) {
                val kLower = key.lowercase()
                if (kLower != "origin" && kLower != "referer" && kLower != "user-agent") {
                    reqBuilder.header(key, value)
                }
            }
            reqBuilder.header("User-Agent", REDGIFS_UA)
            reqBuilder.header("Referer", "https://www.redgifs.com/")
            reqBuilder.header("Origin", "https://www.redgifs.com")
            reqBuilder.header("Accept", "application/json, text/plain, */*")

            var resp = client.newCall(reqBuilder.build()).execute()
            if (resp.code == 401) {
                redGifsToken = null
                redGifsExpires = 0L
                val freshToken = getRedGifsToken()
                if (freshToken != null) {
                    reqBuilder.header("Authorization", "Bearer $freshToken")
                    resp = client.newCall(reqBuilder.build()).execute()
                }
            }

            val bodyBytes = resp.body?.bytes() ?: ByteArray(0)
            val contentType = resp.header("Content-Type", "application/json; charset=utf-8") ?: "application/json"

            val headers = mutableMapOf<String, String>()
            headers["Access-Control-Allow-Origin"] = "*"
            headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            headers["Access-Control-Allow-Headers"] = "*"
            headers["Content-Type"] = contentType

            WebResourceResponse(
                "application/json",
                "UTF-8",
                resp.code,
                resp.message.ifEmpty { "OK" },
                headers,
                ByteArrayInputStream(bodyBytes)
            )
        } catch (e: Exception) {
            Log.e("All18Api", "Error proxying RedGifs: ${e.message}")
            null
        }
    }

    private fun createCorsOptionsResponse(): WebResourceResponse {
        val headers = mapOf(
            "Access-Control-Allow-Origin" to "*",
            "Access-Control-Allow-Methods" to "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers" to "Authorization, Content-Type, Accept, Origin, User-Agent, Range",
            "Access-Control-Max-Age" to "86400"
        )
        return WebResourceResponse(
            "text/plain",
            "UTF-8",
            204,
            "No Content",
            headers,
            ByteArrayInputStream(ByteArray(0))
        )
    }

    private fun proxyRedGifsMedia(request: WebResourceRequest): WebResourceResponse? {
        val url = request.url.toString()
        return try {
            val reqBuilder = Request.Builder().url(url)

            for ((key, value) in request.requestHeaders) {
                val kLower = key.lowercase()
                if (kLower != "referer" && kLower != "origin" && kLower != "user-agent") {
                    reqBuilder.header(key, value)
                }
            }

            // Impersonate legitimate RedGifs web client to eliminate 403 Forbidden
            reqBuilder.header("Referer", "https://www.redgifs.com/")
            reqBuilder.header("Origin", "https://www.redgifs.com")
            reqBuilder.header("User-Agent", REDGIFS_UA)

            val resp = mediaClient.newCall(reqBuilder.build()).execute()

            val contentType = resp.header("Content-Type") ?: if (url.contains(".mp4")) "video/mp4" else "image/jpeg"
            val mimeType = contentType.substringBefore(";").trim()
            val encoding = if (contentType.contains("charset=")) contentType.substringAfter("charset=").trim() else "UTF-8"

            val responseHeaders = mutableMapOf<String, String>()
            responseHeaders["Access-Control-Allow-Origin"] = "*"
            responseHeaders["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
            responseHeaders["Access-Control-Allow-Headers"] = "*"
            responseHeaders["Accept-Ranges"] = "bytes"
            responseHeaders["Content-Type"] = contentType

            resp.header("Content-Range")?.let { responseHeaders["Content-Range"] = it }
            resp.header("Content-Length")?.let { responseHeaders["Content-Length"] = it }
            resp.header("ETag")?.let { responseHeaders["ETag"] = it }
            resp.header("Last-Modified")?.let { responseHeaders["Last-Modified"] = it }

            val stream = resp.body?.byteStream() ?: ByteArrayInputStream(ByteArray(0))

            WebResourceResponse(
                mimeType,
                encoding,
                resp.code,
                resp.message.ifEmpty { "OK" },
                responseHeaders,
                stream
            )
        } catch (e: Exception) {
            Log.e("All18Api", "Error proxying RedGifs media ($url): ${e.message}")
            null
        }
    }


    private fun handleApiRequest(uri: Uri): WebResourceResponse {
        val action = uri.getQueryParameter("action") ?: "search"
        val q = uri.getQueryParameter("q") ?: ""
        val category = uri.getQueryParameter("category") ?: ""
        val source = uri.getQueryParameter("source") ?: "all"
        val page = uri.getQueryParameter("page")?.toIntOrNull() ?: 1
        val filter = uri.getQueryParameter("filter") ?: "trending"

        return when (action) {
            "categories" -> getCategoriesResponse()
            "user_posts" -> getUserPostsResponse(q, category)
            "photos" -> getPhotosResponse(q, category, page)
            "search" -> getSearchResponse(q, category, source, page, filter)
            else -> createJsonResponse("{\"status\":\"error\",\"message\":\"Unknown action\"}")
        }
    }

    private fun getCategoriesResponse(): WebResourceResponse {
        val categoriesJson = """
            {
                "status": "success",
                "data": [
                    {"slug": "", "name": "🔥 Todo"},
                    {"slug": "latina", "name": "💃 Latinas"},
                    {"slug": "amateur", "name": "🎥 Casero / Amateur"},
                    {"slug": "verified-models", "name": "⭐ Modelos Populares"},
                    {"slug": "milf", "name": "💄 MILF"},
                    {"slug": "big-ass", "name": "🍑 Culos Grandes"},
                    {"slug": "big-tits", "name": "🍒 Tetas Grandes"},
                    {"slug": "cosplay", "name": "🎭 Cosplay Hot"},
                    {"slug": "teen-18", "name": "✨ Jovencitas (18+)"},
                    {"slug": "blowjob", "name": "💋 Oral / Mamadas"},
                    {"slug": "anal", "name": "🔥 Anal"},
                    {"slug": "lesbian", "name": "👭 Lesbiana"},
                    {"slug": "threesome", "name": "⚡ Tríos"},
                    {"slug": "pov", "name": "👀 POV"}
                ]
            }
        """.trimIndent()
        return createJsonResponse(categoriesJson)
    }

    private fun getUserPostsResponse(q: String, category: String): WebResourceResponse {
        val jsonArray = JSONArray()
        try {
            val file = File(context.filesDir, "user_posts.json")
            if (file.exists()) {
                val raw = file.readText()
                val parsed = JSONArray(raw)
                for (i in 0 until parsed.length()) {
                    jsonArray.put(parsed.getJSONObject(i))
                }
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Failed reading user posts: ${e.message}")
        }

        val result = JSONObject()
        result.put("status", "success")
        result.put("count", jsonArray.length())
        result.put("data", jsonArray)
        return createJsonResponse(result.toString())
    }

    private fun getPhotosResponse(q: String, category: String, page: Int): WebResourceResponse {
        val items: JSONArray = fetchPhotos(q, category, page)
        val countVal: Int = items.length()
        val result = JSONObject().apply {
            put("status", "success")
            put("count", countVal)
            put("page", page)
            put("query", q)
            put("category", category)
            put("type", "photo")
            put("data", items)
        }
        return createJsonResponse(result.toString())
    }

    private fun getSearchResponse(q: String, category: String, source: String, page: Int, filter: String): WebResourceResponse {
        // Direct photo search support
        if (source.equals("photos", ignoreCase = true) ||
            source.equals("hentai", ignoreCase = true) ||
            source.equals("booru", ignoreCase = true) ||
            category.equals("photos", ignoreCase = true) ||
            category.equals("hentai", ignoreCase = true)
        ) {
            val photoItems: JSONArray = fetchPhotos(q, category, page)
            val countVal: Int = photoItems.length()
            val responseJson = JSONObject().apply {
                put("status", "success")
                put("page", page)
                put("query", q)
                put("category", category)
                put("source", source)
                put("count", countVal)
                put("data", photoItems)
            }
            return createJsonResponse(responseJson.toString())
        }

        // Direct ID lookup support (e.g. from watch.html)
        if (q.startsWith("ph_") || q.startsWith("rt_") || q.startsWith("rg_") || q.startsWith("xv_") || q.startsWith("xn_") || q.startsWith("yp_") || q.startsWith("yd_") || q.startsWith("kc_") || q.startsWith("ep_") || q.startsWith("sb_") || q.startsWith("bg_")) {
            val directItem = createDirectItemFromId(q)
            if (directItem != null) {
                val singleArr = JSONArray().apply { put(directItem) }
                val respObj = JSONObject().apply {
                    put("status", "success")
                    put("count", 1)
                    put("page", 1)
                    put("data", singleArr)
                }
                return createJsonResponse(respObj.toString())
            }
        }

        val catMap = mapOf(
            "teen-18" to "teen",
            "big-ass" to "big ass",
            "big-tits" to "big tits",
            "verified-models" to "model",
            "blowjob" to "blowjob"
        )
        val mappedCat = catMap[category] ?: category
        val queryTerm = when {
            q.isNotBlank() -> q
            mappedCat.isNotBlank() -> mappedCat
            else -> "latina"
        }

        val allItems = JSONArray()

        when (source.lowercase()) {
            "redgifs" -> {
                val rgItems = fetchRedGifs(queryTerm, page)
                for (i in 0 until rgItems.length()) allItems.put(rgItems.getJSONObject(i))
            }
            "pornhub" -> {
                val phItems = fetchPornhub(queryTerm, page, filter)
                for (i in 0 until phItems.length()) allItems.put(phItems.getJSONObject(i))
            }
            "redtube" -> {
                val rtItems = fetchRedTube(queryTerm, page)
                for (i in 0 until rtItems.length()) allItems.put(rtItems.getJSONObject(i))
            }
            "xvideos" -> {
                val xvItems = fetchXVideos(queryTerm, page)
                for (i in 0 until xvItems.length()) allItems.put(xvItems.getJSONObject(i))
            }
            "xnxx" -> {
                val xnItems = fetchXNXX(queryTerm, page)
                for (i in 0 until xnItems.length()) allItems.put(xnItems.getJSONObject(i))
            }
            "youporn" -> {
                val ypItems = fetchYouPorn(queryTerm, page)
                for (i in 0 until ypItems.length()) allItems.put(ypItems.getJSONObject(i))
            }
            "eporner" -> {
                val epItems = fetchEporner(queryTerm, page)
                for (i in 0 until epItems.length()) allItems.put(epItems.getJSONObject(i))
            }
            else -> { // "all" - Concurrent parallel queries across all 6 networks
                val executor = Executors.newFixedThreadPool(6)
                val fPH = executor.submit(Callable { fetchPornhub(queryTerm, page, filter) })
                val fXV = executor.submit(Callable { fetchXVideos(queryTerm, page) })
                val fXN = executor.submit(Callable { fetchXNXX(queryTerm, page) })
                val fYP = executor.submit(Callable { fetchYouPorn(queryTerm, page) })
                val fRT = executor.submit(Callable { fetchRedTube(queryTerm, page) })
                val fRG = executor.submit(Callable { fetchRedGifs(queryTerm, page) })

                val phItems = try { fPH.get(7, TimeUnit.SECONDS) } catch (e: Exception) { JSONArray() }
                val xvItems = try { fXV.get(7, TimeUnit.SECONDS) } catch (e: Exception) { JSONArray() }
                val xnItems = try { fXN.get(7, TimeUnit.SECONDS) } catch (e: Exception) { JSONArray() }
                val ypItems = try { fYP.get(7, TimeUnit.SECONDS) } catch (e: Exception) { JSONArray() }
                val rtItems = try { fRT.get(7, TimeUnit.SECONDS) } catch (e: Exception) { JSONArray() }
                val rgItems = try { fRG.get(7, TimeUnit.SECONDS) } catch (e: Exception) { JSONArray() }
                executor.shutdown()

                val maxLen = maxOf(phItems.length(), xvItems.length(), xnItems.length(), ypItems.length(), rtItems.length(), rgItems.length())
                for (i in 0 until maxLen) {
                    if (i < phItems.length()) allItems.put(phItems.getJSONObject(i))
                    if (i < xvItems.length()) allItems.put(xvItems.getJSONObject(i))
                    if (i < xnItems.length()) allItems.put(xnItems.getJSONObject(i))
                    if (i < ypItems.length()) allItems.put(ypItems.getJSONObject(i))
                    if (i < rtItems.length()) allItems.put(rtItems.getJSONObject(i))
                    if (i < rgItems.length()) allItems.put(rgItems.getJSONObject(i))
                }
            }
        }

        if (allItems.length() == 0) {
            val fallbackItems = getCuratedFallbackVideos(source)
            for (i in 0 until fallbackItems.length()) {
                allItems.put(fallbackItems.getJSONObject(i))
            }
        }

        val responseJson = JSONObject()
        responseJson.put("status", "success")
        responseJson.put("page", page)
        responseJson.put("query", q)
        responseJson.put("category", category)
        responseJson.put("source", source)
        responseJson.put("count", allItems.length())
        responseJson.put("data", allItems)

        return createJsonResponse(responseJson.toString())
    }

    private fun getCuratedFallbackVideos(source: String): JSONArray {
        val list = JSONArray()
        val baseItems = listOf(
            Triple("ph_65a83a21b8f01", "Pornhub", "Sensual Latina Exclusiva"),
            Triple("xv_74829103", "XVideos", "Casero Ardiente HD"),
            Triple("xn_63829104", "XNXX", "Top Model Colección Especial"),
            Triple("yp_15829105", "YouPorn", "Pasión Intensa Estudio"),
            Triple("rt_8492019", "RedTube", "Trío Salvaje Exclusivo"),
            Triple("rg_sprycaringafricangroundhornbill", "RedGifs", "Short Hot Viral Loop"),
            Triple("sb_7849102", "SpankBang", "Top Latina Glamour 4K"),
            Triple("bg_9182301", "Beeg", "Sensual Ultra HD Collection"),
            Triple("ep_cIG0retUIzC", "Eporner", "Exclusivo Pure 1080p 60fps")
        )
        for ((id, src, title) in baseItems) {
            if (source != "all" && !source.equals(src, ignoreCase = true)) continue
            val item = createDirectItemFromId(id) ?: continue
            item.put("title", title)
            list.put(item)
        }
        return list
    }

    private fun createDirectItemFromId(id: String): JSONObject? {
        return when {
            id.startsWith("ph_") -> {
                val rawId = id.removePrefix("ph_")
                val thumb = "https://ci.phncdn.com/videos/202401/15/sample.jpg"
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video All18")
                    put("duration", "10:00")
                    put("views", "180K vistas")
                    put("rating", "96%")
                    put("author", "@PornhubStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().apply { put(thumb); put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://www.pornhub.com/embed/$rawId")
                    put("embed_url", "https://www.pornhub.com/embed/$rawId")
                    put("media_url", "")
                    put("source", "Pornhub")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
            }
            id.startsWith("xv_") -> {
                val rawId = id.removePrefix("xv_")
                val thumb = "https://thumb-cdn77.xvideos-cdn.com/67986a0e-c2b4-4983-b2ab-89feb5324822/6/xv_9_t.jpg"
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video XVideos")
                    put("duration", "12:30")
                    put("views", "320K vistas")
                    put("rating", "97%")
                    put("author", "@XVideosStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().apply { put(thumb); put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://www.xvideos.com/video$rawId")
                    put("embed_url", "https://www.xvideos.com/embedframe/$rawId")
                    put("media_url", "")
                    put("source", "XVideos")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
            }
            id.startsWith("xn_") -> {
                val rawId = id.removePrefix("xn_")
                val thumb = "https://thumb-cdn77.xnxx-cdn.com/1b53d77b-1f71-4395-b0f0-7fee246cd5d8/6/xn_15_t.jpg"
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video XNXX")
                    put("duration", "11:15")
                    put("views", "290K vistas")
                    put("rating", "96%")
                    put("author", "@XNXXStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().apply { put(thumb); put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://www.xnxx.com/video-$rawId")
                    put("embed_url", "https://www.xnxx.com/embedframe/$rawId")
                    put("media_url", "")
                    put("source", "XNXX")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
            }
            id.startsWith("yp_") -> {
                val rawId = id.removePrefix("yp_")
                val thumb = "https://fi1.ypncdn.com/202305/01/sample.jpg"
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video YouPorn")
                    put("duration", "14:20")
                    put("views", "210K vistas")
                    put("rating", "95%")
                    put("author", "@YouPornStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().apply { put(thumb); put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://www.youporn.com/watch/$rawId")
                    put("embed_url", "https://www.youporn.com/embed/$rawId")
                    put("media_url", "")
                    put("source", "YouPorn")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
            }
            id.startsWith("rt_") -> {
                val rawId = id.removePrefix("rt_")
                val thumb = "https://ei.rdtcdn.com/videos/sample.jpg"
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video All18")
                    put("duration", "08:45")
                    put("views", "150K vistas")
                    put("rating", "94%")
                    put("author", "@RedTubeStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().apply { put(thumb); put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://embed.redtube.com/?id=$rawId")
                    put("embed_url", "https://embed.redtube.com/?id=$rawId")
                    put("media_url", "")
                    put("source", "RedTube")
                    put("type", "video")
                    put("quality", "720p HD")
                }
            }
            id.startsWith("rg_") -> {
                val rawId = id.removePrefix("rg_")
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Short Clip Hot")
                    put("duration", "Short")
                    put("views", "85K vistas")
                    put("rating", "98%")
                    put("author", "@All18Creator")
                    put("thumb", "https://media.redgifs.com/$rawId-poster.jpg")
                    put("thumbs", JSONArray().apply {
                        put("https://media.redgifs.com/$rawId-poster.jpg")
                        put(AMOLED_DEFAULT_POSTER)
                    })
                    put("media_url", "https://media.redgifs.com/$rawId.mp4")
                    put("embed_url", "https://www.redgifs.com/ifr/$rawId?autoplay=1")
                    put("source", "RedGifs")
                    put("type", "short")
                    put("quality", "1080p 60fps")
                }
            }
            id.startsWith("yd_") || id.startsWith("kc_") || id.startsWith("sf_") -> {
                val rawId = id.substringAfter("_")
                val src = if (id.startsWith("yd_")) "Yande.re" else if (id.startsWith("kc_")) "Konachan" else "Safebooru"
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Foto Hot Exclusiva HD")
                    put("duration", "Foto HD")
                    put("views", "42K vistas")
                    put("rating", "98%")
                    put("author", "@Artist")
                    put("thumb", AMOLED_DEFAULT_POSTER)
                    put("thumbs", JSONArray().apply { put(AMOLED_DEFAULT_POSTER) })
                    put("photo_url", "")
                    put("media_url", "")
                    put("embed_url", "")
                    put("source", src)
                    put("type", "photo")
                    put("quality", "1920x1080")
                }
            }
            id.startsWith("ep_") -> {
                val rawId = id.removePrefix("ep_")
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video Eporner HD")
                    put("duration", "10:00")
                    put("views", "180K vistas")
                    put("rating", "98%")
                    put("author", "@EpornerCreator")
                    put("thumb", AMOLED_DEFAULT_POSTER)
                    put("thumbs", JSONArray().apply { put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://www.eporner.com/embed/$rawId/")
                    put("embed_url", "https://www.eporner.com/embed/$rawId/")
                    put("media_url", "")
                    put("source", "Eporner")
                    put("type", "video")
                    put("quality", "1080p 60fps")
                }
            }
            id.startsWith("sb_") -> {
                val rawId = id.removePrefix("sb_")
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video SpankBang HD")
                    put("duration", "10:00")
                    put("views", "210K vistas")
                    put("rating", "97%")
                    put("author", "@SpankBangCreator")
                    put("thumb", AMOLED_DEFAULT_POSTER)
                    put("thumbs", JSONArray().apply { put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://spankbang.com/$rawId/embed/")
                    put("embed_url", "https://spankbang.com/$rawId/embed/")
                    put("media_url", "")
                    put("source", "SpankBang")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
            }
            id.startsWith("bg_") -> {
                val rawId = id.removePrefix("bg_")
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video Beeg HD")
                    put("duration", "10:00")
                    put("views", "195K vistas")
                    put("rating", "96%")
                    put("author", "@BeegCreator")
                    put("thumb", AMOLED_DEFAULT_POSTER)
                    put("thumbs", JSONArray().apply { put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://beeg.com/$rawId")
                    put("embed_url", "https://beeg.com/$rawId")
                    put("media_url", "")
                    put("source", "Beeg")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
            }
            else -> null
        }
    }

    companion object {
        private const val REDGIFS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        const val AMOLED_DEFAULT_POSTER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23000000'/%3E%3Ccircle cx='320' cy='180' r='36' fill='%23111115' stroke='%2322222a' stroke-width='2'/%3E%3Cpolygon points='314,166 334,180 314,194' fill='%23ffffff'/%3E%3Ctext x='320' y='245' font-family='sans-serif' font-size='15' font-weight='800' fill='%23666677' text-anchor='middle'%3EALL18 HD%3C/text%3E%3C/svg%3E"

        val AD_DOMAINS = setOf(
            "exoclick.com",
            "trafficjunky.net",
            "trafficjunky.com",
            "trafficfactory.biz",
            "juicyads.com",
            "popcash.net",
            "popads.net",
            "propellerads.com",
            "ero-advertising.com",
            "eroadvertising.com",
            "realsrv.com",
            "clckr.com",
            "adx1.com",
            "etahub.com",
            "adxpansion.com",
            "tsyndicate.com",
            "adtng.com",
            "chaturbate.com",
            "bongacams.com",
            "livejasmin.com",
            "stripchat.com",
            "stripcdn.com",
            "doubleclick.net",
            "googlesyndication.com",
            "google-analytics.com",
            "yandex.ru",
            "scorecardresearch.com",
            "clickadu.com",
            "adsterra.com",
            "hilltopads.net",
            "monetag.com",
            "engine.phncdn.com"
        )

        fun isAdRequest(uri: Uri): Boolean {
            val host = uri.host?.lowercase() ?: return false
            return AD_DOMAINS.any { host.contains(it) }
        }
    }

    private fun getRedGifsToken(): String? {
        val now = System.currentTimeMillis()
        if (!redGifsToken.isNullOrEmpty() && redGifsExpires > now) {
            return redGifsToken
        }

        return try {
            val req = Request.Builder()
                .url("https://api.redgifs.com/v2/auth/temporary")
                .header("User-Agent", REDGIFS_UA)
                .header("Referer", "https://www.redgifs.com/")
                .header("Origin", "https://www.redgifs.com")
                .header("Accept", "application/json, text/plain, */*")
                .build()
            val resp = client.newCall(req).execute()
            val body = resp.body?.string() ?: return null
            val json = JSONObject(body)
            val token = json.optString("token")
            if (token.isNotEmpty()) {
                redGifsToken = token
                redGifsExpires = now + (3600 * 1000)
                token
            } else null
        } catch (e: Exception) {
            Log.e("All18Api", "Error getting RedGifs token: ${e.message}")
            null
        }
    }

    private fun fetchRedGifs(query: String, page: Int): JSONArray {
        val list = JSONArray()
        val token = getRedGifsToken() ?: return list

        val cleanQuery = if (query.isBlank()) "hot" else query
        val url = "https://api.redgifs.com/v2/gifs/search?search_text=${Uri.encode(cleanQuery)}&count=24&page=$page&order=trending"

        try {
            val req = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .header("User-Agent", REDGIFS_UA)
                .header("Referer", "https://www.redgifs.com/")
                .header("Origin", "https://www.redgifs.com")
                .header("Accept", "application/json, text/plain, */*")
                .build()

            var resp = client.newCall(req).execute()
            if (resp.code == 401) {
                // Token invalid or rejected, reset and retry once with fresh token
                redGifsToken = null
                redGifsExpires = 0L
                val freshToken = getRedGifsToken()
                if (freshToken != null) {
                    val retryReq = Request.Builder()
                        .url(url)
                        .header("Authorization", "Bearer $freshToken")
                        .header("User-Agent", REDGIFS_UA)
                        .header("Referer", "https://www.redgifs.com/")
                        .header("Origin", "https://www.redgifs.com")
                        .header("Accept", "application/json, text/plain, */*")
                        .build()
                    resp = client.newCall(retryReq).execute()
                }
            }

            val body = resp.body?.string() ?: return list
            val json = JSONObject(body)
            val gifs = json.optJSONArray("gifs") ?: return list

            for (i in 0 until gifs.length()) {
                val g = gifs.getJSONObject(i)
                val gid = g.optString("id")
                if (gid.isEmpty()) continue

                val urls = g.optJSONObject("urls") ?: JSONObject()
                val poster = urls.optString("poster").ifEmpty {
                    urls.optString("thumbnail").ifEmpty { "https://media.redgifs.com/$gid-poster.jpg" }
                }
                val hdUrl = urls.optString("hd").ifEmpty { "" }
                val sdUrl = urls.optString("sd").ifEmpty { "" }
                val silentUrl = urls.optString("silent").ifEmpty { "" }
                val mp4 = sdUrl.ifEmpty { hdUrl.ifEmpty { silentUrl } }

                val tags = g.optJSONArray("tags")
                val title = if (tags != null && tags.length() > 0) {
                    val sb = StringBuilder()
                    for (t in 0 until minOf(3, tags.length())) {
                        sb.append(tags.getString(t)).append(" ")
                    }
                    sb.toString().trim().replaceFirstChar { it.uppercase() }
                } else "Short Clip Hot"

                val views = g.optInt("views", 12500)
                val viewsStr = if (views > 1_000_000) "${views / 1_000_000}M" else "${views / 1000}K"

                val item = JSONObject()
                item.put("id", "rg_$gid")
                item.put("raw_id", gid)
                item.put("title", title)
                item.put("duration", "Short")
                item.put("views", "$viewsStr vistas")
                item.put("rating", "98%")
                item.put("author", "@" + g.optString("userName", "All18Creator"))
                item.put("thumb", poster)
                val thumbsArr = JSONArray().apply { put(poster) }
                item.put("thumbs", thumbsArr)
                item.put("media_url", mp4)
                item.put("hd_url", hdUrl)
                item.put("sd_url", sdUrl)
                item.put("embed_url", "https://www.redgifs.com/ifr/$gid?autoplay=1")
                item.put("source", "RedGifs")
                item.put("type", "short")
                item.put("quality", "1080p 60fps")
                list.put(item)
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error fetching RedGifs: ${e.message}")
        }
        return list
    }

    private fun fetchPornhub(query: String, page: Int, filter: String): JSONArray {
        val list = JSONArray()
        val cleanQuery = query.trim()
        val url = if (cleanQuery.isBlank() || cleanQuery == "hot" || cleanQuery == "trending" || cleanQuery == "latina") {
            "https://www.pornhub.com/video?o=tr&page=$page"
        } else {
            "https://www.pornhub.com/video/search?search=${Uri.encode(cleanQuery)}&page=$page"
        }

        try {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "es-ES,es;q=0.9,en;q=0.8")
                .build()

            val resp = client.newCall(req).execute()
            val html = resp.body?.string() ?: return list

            val liRegex = Pattern.compile("""<li[^>]+class="[^"]*videoBox[^"]*"[^>]*>(.*?)</li>""", Pattern.DOTALL)
            val matcher = liRegex.matcher(html)

            val vkeyPattern = Pattern.compile("""(?:_vkey|data-video-vkey)="([a-zA-Z0-9]+)"|viewkey=([a-zA-Z0-9]+)""")
            val titlePattern = Pattern.compile("""<a[^>]+title="([^"]+)"|class="title"[^>]*>.*?<a[^>]*>([^<]+)</a>""", Pattern.DOTALL)
            val thumbPattern = Pattern.compile("""<img[^>]+(?:data-image|data-thumb_url|data-src|src)="([^"]+)"""")
            val durPattern = Pattern.compile("""<var class="duration">([^<]+)</var>|class="duration">([^<]+)<""")

            while (matcher.find()) {
                val cardContent = matcher.group(1) ?: continue
                val fullTag = matcher.group(0) ?: ""

                val vkM = vkeyPattern.matcher(fullTag)
                if (!vkM.find()) continue
                val vkey = vkM.group(1) ?: vkM.group(2) ?: continue

                val tM = titlePattern.matcher(cardContent)
                val rawTitle = if (tM.find()) {
                    tM.group(1) ?: tM.group(2) ?: "Video Pornhub"
                } else "Video Pornhub"
                val title = Html.fromHtml(rawTitle.trim(), Html.FROM_HTML_MODE_LEGACY).toString()

                val thM = thumbPattern.matcher(cardContent)
                val rawThumb = if (thM.find()) thM.group(1)?.trim() ?: "" else ""
                val thumb = when {
                    rawThumb.startsWith("//") -> "https:$rawThumb"
                    rawThumb.isNotBlank() -> rawThumb
                    else -> AMOLED_DEFAULT_POSTER
                }

                val dM = durPattern.matcher(cardContent)
                val duration = if (dM.find()) (dM.group(1) ?: dM.group(2))?.trim() ?: "10:00" else "10:00"

                val item = JSONObject().apply {
                    put("id", "ph_$vkey")
                    put("raw_id", vkey)
                    put("title", title)
                    put("duration", duration)
                    put("views", "190K vistas")
                    put("rating", "96%")
                    put("author", "@PornhubStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().apply { put(thumb); put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://www.pornhub.com/view_video.php?viewkey=$vkey")
                    put("embed_url", "https://www.pornhub.com/embed/$vkey")
                    put("media_url", "")
                    put("source", "Pornhub")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
                list.put(item)
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error scraping Pornhub: ${e.message}")
        }
        return list
    }

    private fun fetchRedTube(query: String, page: Int): JSONArray {
        val list = JSONArray()
        val cleanQuery = query.trim()
        val url = if (cleanQuery.isBlank() || cleanQuery == "hot" || cleanQuery == "trending" || cleanQuery == "latina") {
            "https://www.redtube.com/?page=$page"
        } else {
            "https://www.redtube.com/?search=${Uri.encode(cleanQuery)}&page=$page"
        }

        try {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "es-ES,es;q=0.9,en;q=0.8")
                .build()

            val resp = client.newCall(req).execute()
            val html = resp.body?.string() ?: return list

            val liRegex = Pattern.compile("""<li[^>]+data-video-id="(\d+)"[^>]*>(.*?)</li>""", Pattern.DOTALL)
            val matcher = liRegex.matcher(html)

            val titlePattern = Pattern.compile("""class="video-title-text[^"]*"[^>]*title="([^"]+)"|<img[^>]+alt="([^"]+)"""")
            val thumbPattern = Pattern.compile("""<img[^>]+(?:data-src|data-o_thumb)="([^"]+)"""")
            val durPattern = Pattern.compile("""class="video-properties\s+tm_video_duration">([^<]+)</span>|class="duration">.*?([0-9]+:[0-9]+)""")

            while (matcher.find()) {
                val vid = matcher.group(1) ?: continue
                val cardContent = matcher.group(2) ?: continue

                val tM = titlePattern.matcher(cardContent)
                val rawTitle = if (tM.find()) {
                    tM.group(1) ?: tM.group(2) ?: "Video RedTube"
                } else "Video RedTube"
                val title = Html.fromHtml(rawTitle.trim(), Html.FROM_HTML_MODE_LEGACY).toString()

                val thM = thumbPattern.matcher(cardContent)
                val rawThumb = if (thM.find()) thM.group(1)?.trim() ?: "" else ""
                val thumb = when {
                    rawThumb.startsWith("//") -> "https:$rawThumb"
                    rawThumb.isNotBlank() -> rawThumb
                    else -> AMOLED_DEFAULT_POSTER
                }

                val dM = durPattern.matcher(cardContent)
                val duration = if (dM.find()) (dM.group(1) ?: dM.group(2))?.trim() ?: "08:45" else "08:45"

                val item = JSONObject().apply {
                    put("id", "rt_$vid")
                    put("raw_id", vid)
                    put("title", title)
                    put("duration", duration)
                    put("views", "175K vistas")
                    put("rating", "95%")
                    put("author", "@RedTubeStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().apply { put(thumb); put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://www.redtube.com/$vid")
                    put("embed_url", "https://embed.redtube.com/?id=$vid")
                    put("media_url", "")
                    put("source", "RedTube")
                    put("type", "video")
                    put("quality", "720p HD")
                }
                list.put(item)
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error scraping RedTube: ${e.message}")
        }
        return list
    }

    private fun fetchYouPorn(query: String, page: Int): JSONArray {
        val list = JSONArray()
        val cleanQuery = query.trim()
        val url = if (cleanQuery.isBlank() || cleanQuery == "hot" || cleanQuery == "trending" || cleanQuery == "latina") {
            "https://www.youporn.com/?page=$page"
        } else {
            "https://www.youporn.com/search/?query=${Uri.encode(cleanQuery)}&page=$page"
        }

        try {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "es-ES,es;q=0.9,en;q=0.8")
                .build()

            val resp = client.newCall(req).execute()
            val html = resp.body?.string() ?: return list

            val articleRegex = Pattern.compile("""<article[^>]+data-video-id="(\d+)"[^>]*>(.*?)</article>""", Pattern.DOTALL)
            val matcher = articleRegex.matcher(html)

            val titlePattern = Pattern.compile("""class="video-title-text[^"]*"[^>]*>.*?<span>(.*?)</span>|aria-label="([^"]+)"""", Pattern.DOTALL)
            val thumbPattern = Pattern.compile("""<img[^>]+(?:data-poster|data-src)="([^"]+)"""")
            val durPattern = Pattern.compile("""class="video-duration[^"]*"[^>]*>.*?<span>([^<]+)</span>""", Pattern.DOTALL)

            while (matcher.find()) {
                val vid = matcher.group(1) ?: continue
                val cardContent = matcher.group(2) ?: continue
                val fullTag = matcher.group(0) ?: ""

                val tM = titlePattern.matcher(cardContent)
                val rawTitle = if (tM.find()) {
                    tM.group(1) ?: tM.group(2) ?: "Video YouPorn"
                } else {
                    val labelM = Pattern.compile("""aria-label="([^"]+)"""").matcher(fullTag)
                    if (labelM.find()) {
                        labelM.group(1) ?: "Video YouPorn"
                    } else {
                        "Video YouPorn"
                    }
                }
                val title = Html.fromHtml(rawTitle.trim(), Html.FROM_HTML_MODE_LEGACY).toString()

                val thM = thumbPattern.matcher(cardContent)
                val rawThumb = if (thM.find()) thM.group(1)?.trim() ?: "" else ""
                val thumb = when {
                    rawThumb.startsWith("//") -> "https:$rawThumb"
                    rawThumb.isNotBlank() -> rawThumb
                    else -> AMOLED_DEFAULT_POSTER
                }

                val dM = durPattern.matcher(cardContent)
                val duration = if (dM.find()) dM.group(1)?.trim() ?: "11:30" else "11:30"

                val item = JSONObject().apply {
                    put("id", "yp_$vid")
                    put("raw_id", vid)
                    put("title", title)
                    put("duration", duration)
                    put("views", "220K vistas")
                    put("rating", "96%")
                    put("author", "@YouPornStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().apply { put(thumb); put(AMOLED_DEFAULT_POSTER) })
                    put("url", "https://www.youporn.com/watch/$vid/")
                    put("embed_url", "https://www.youporn.com/embed/$vid")
                    put("media_url", "")
                    put("source", "YouPorn")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
                list.put(item)
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error scraping YouPorn: ${e.message}")
        }
        return list
    }

    private fun fetchXVideos(query: String, page: Int): JSONArray {
        val list = JSONArray()
        val cleanQuery = if (query.isBlank()) "trending" else query
        val url = if (cleanQuery == "trending") {
            "https://www.xvideos.com/new/$page"
        } else {
            "https://www.xvideos.com/?k=${Uri.encode(cleanQuery)}&p=$page"
        }

        try {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "es-ES,es;q=0.9,en;q=0.8")
                .build()

            val resp = client.newCall(req).execute()
            val html = resp.body?.string() ?: return list

            // Multi-pattern support: thumb-block modern layout and thumb-inside classic layout
            val blockRegex = Pattern.compile("""<div[^>]+id="video_([a-zA-Z0-9_-]+)"[^>]*class="[^"]*thumb-block[^"]*"[^>]*>([\s\S]*?)</div>\s*</div>\s*</div>""", Pattern.DOTALL)
            val blockMatcher = blockRegex.matcher(html)

            val cards = mutableListOf<Pair<String, String>>()
            while (blockMatcher.find()) {
                val vid = blockMatcher.group(1) ?: continue
                val content = blockMatcher.group(2) ?: continue
                cards.add(Pair(vid, content))
            }

            if (cards.isEmpty()) {
                val fallbackRegex = Pattern.compile("""class="thumb-inside">([\s\S]*?)</div>""", Pattern.DOTALL)
                val fm = fallbackRegex.matcher(html)
                while (fm.find()) {
                    val content = fm.group(1) ?: continue
                    val vidM = Pattern.compile("""/video[._-]?([a-zA-Z0-9_-]+)/""").matcher(content)
                    if (vidM.find()) {
                        val vid = vidM.group(1) ?: continue
                        cards.add(Pair(vid, content))
                    }
                }
            }

            for ((vid, cardHtml) in cards) {
                // Official cover extraction: check data-sfwthumb > data-src > data-mzl > src (skip lightbox-blank.gif)
                val thumbM = Pattern.compile("""(?:data-sfwthumb|data-src|data-mzl|src)="([^"]+)"""").matcher(cardHtml)
                var rawThumb = ""
                while (thumbM.find()) {
                    val c = thumbM.group(1)?.trim() ?: ""
                    if (c.isNotEmpty() && !c.contains("blank.gif") && !c.contains("lightbox-blank")) {
                        rawThumb = c
                        break
                    }
                }

                if (rawThumb.startsWith("//")) rawThumb = "https:$rawThumb"
                rawThumb = rawThumb.replace("THUMBNUM", "15")

                val thumb = when {
                    rawThumb.isNotBlank() -> rawThumb
                    else -> "https://thumbs-gcore.xvideos-cdn.com/videos/thumbs169poster/sample.jpg"
                }

                // Official title
                val titleM = Pattern.compile("""<p class="title"[^>]*>.*?<a[^>]+title="([^"]+)"|<a[^>]+title="([^"]+)"|title="([^"]+)"|<p class="title"[^>]*>.*?<a[^>]*>([^<]+)</a>""", Pattern.DOTALL).matcher(cardHtml)
                val rawTitle = if (titleM.find()) {
                    titleM.group(1) ?: titleM.group(2) ?: titleM.group(3) ?: titleM.group(4) ?: "Video XVideos"
                } else "Video XVideos"
                val title = Html.fromHtml(rawTitle.trim(), Html.FROM_HTML_MODE_LEGACY).toString()

                val durM = Pattern.compile("""<span class="duration">([^<]+)</span>""").matcher(cardHtml)
                val duration = if (durM.find()) durM.group(1)?.trim() ?: "10 min" else "10 min"

                // CDN rotation fallbacks
                val thumbsArr = JSONArray().apply {
                    put(thumb)
                    if (thumb.contains("thumbs-gcore.xvideos-cdn.com")) {
                        put(thumb.replace("thumbs-gcore.xvideos-cdn.com", "thumb-cdn77.xvideos-cdn.com"))
                    } else if (thumb.contains("thumb-cdn77.xvideos-cdn.com")) {
                        put(thumb.replace("thumb-cdn77.xvideos-cdn.com", "thumbs-gcore.xvideos-cdn.com"))
                    }
                    if (thumb.contains("_24_t.jpg")) {
                        put(thumb.replace("_24_t.jpg", "_1_t.jpg"))
                    }
                    put(AMOLED_DEFAULT_POSTER)
                }

                val item = JSONObject().apply {
                    put("id", "xv_$vid")
                    put("raw_id", vid)
                    put("title", title)
                    put("duration", duration)
                    put("views", "260K vistas")
                    put("rating", "97%")
                    put("author", "@XVideosStar")
                    put("thumb", thumb)
                    put("thumbs", thumbsArr)
                    put("url", "https://www.xvideos.com/video$vid")
                    put("embed_url", "https://www.xvideos.com/embedframe/$vid")
                    put("media_url", "")
                    put("source", "XVideos")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
                list.put(item)
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error fetching XVideos: ${e.message}")
        }
        return list
    }

    private fun fetchXNXX(query: String, page: Int): JSONArray {
        val list = JSONArray()
        val cleanQuery = if (query.isBlank()) "hot" else query
        val url = if (cleanQuery == "hot" || cleanQuery == "trending") {
            "https://www.xnxx.com/todays-selection/$page"
        } else {
            "https://www.xnxx.com/search/${Uri.encode(cleanQuery)}/$page"
        }

        try {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "es-ES,es;q=0.9,en;q=0.8")
                .build()

            val resp = client.newCall(req).execute()
            val html = resp.body?.string() ?: return list

            val blockRegex = Pattern.compile("""<div[^>]+id="video_([a-zA-Z0-9_-]+)"[^>]*class="[^"]*thumb-block[^"]*"[^>]*>([\s\S]*?)</div>\s*</div>\s*</div>""", Pattern.DOTALL)
            val blockMatcher = blockRegex.matcher(html)

            val cards = mutableListOf<Pair<String, String>>()
            while (blockMatcher.find()) {
                val vid = blockMatcher.group(1) ?: continue
                val content = blockMatcher.group(2) ?: continue
                cards.add(Pair(vid, content))
            }

            if (cards.isEmpty()) {
                val fallbackRegex = Pattern.compile("""class="thumb-inside">([\s\S]*?)</div>""", Pattern.DOTALL)
                val fm = fallbackRegex.matcher(html)
                while (fm.find()) {
                    val content = fm.group(1) ?: continue
                    val vidM = Pattern.compile("""/video-([a-zA-Z0-9_-]+)/""").matcher(content)
                    if (vidM.find()) {
                        val vid = vidM.group(1) ?: continue
                        cards.add(Pair(vid, content))
                    }
                }
            }

            for ((vid, cardHtml) in cards) {
                // Official cover extraction: prioritize data-sfwthumb and data-src, skip lightbox-blank.gif, resolve THUMBNUM
                val thumbM = Pattern.compile("""(?:data-sfwthumb|data-src|data-mzl|src)="([^"]+)"""").matcher(cardHtml)
                var rawThumb = ""
                while (thumbM.find()) {
                    val c = thumbM.group(1)?.trim() ?: ""
                    if (c.isNotEmpty() && !c.contains("blank.gif") && !c.contains("lightbox-blank")) {
                        rawThumb = c
                        break
                    }
                }

                if (rawThumb.startsWith("//")) rawThumb = "https:$rawThumb"
                // Replace placeholder THUMBNUM with web default cover frame (15)
                rawThumb = rawThumb.replace("THUMBNUM", "15")

                val thumb = when {
                    rawThumb.isNotBlank() -> rawThumb
                    else -> "https://thumb-cdn77.xnxx-cdn.com/videos/thumbs169poster/sample_xn.jpg"
                }

                val titleM = Pattern.compile("""<p class="title"[^>]*>.*?<a[^>]+title="([^"]+)"|<a[^>]+title="([^"]+)"|title="([^"]+)"|<p class="title"[^>]*>.*?<a[^>]*>([^<]+)</a>""", Pattern.DOTALL).matcher(cardHtml)
                val rawTitle = if (titleM.find()) {
                    titleM.group(1) ?: titleM.group(2) ?: titleM.group(3) ?: titleM.group(4) ?: "Video XNXX"
                } else "Video XNXX"
                val title = Html.fromHtml(rawTitle.trim(), Html.FROM_HTML_MODE_LEGACY).toString()

                val durM = Pattern.compile("""<span class="duration">([^<]+)</span>""").matcher(cardHtml)
                val duration = if (durM.find()) durM.group(1)?.trim() ?: "12 min" else "12 min"

                // CDN rotation and alternative cover frame fallbacks
                val thumbsArr = JSONArray().apply {
                    put(thumb)
                    if (thumb.contains("thumb-cdn77.xnxx-cdn.com")) {
                        put(thumb.replace("thumb-cdn77.xnxx-cdn.com", "thumbs-gcore.xnxx-cdn.com"))
                    } else if (thumb.contains("thumbs-gcore.xnxx-cdn.com")) {
                        put(thumb.replace("thumbs-gcore.xnxx-cdn.com", "thumb-cdn77.xnxx-cdn.com"))
                    }
                    if (thumb.contains("xn_15_t.jpg")) {
                        put(thumb.replace("xn_15_t.jpg", "xv_15_t.jpg"))
                        put(thumb.replace("xn_15_t.jpg", "xn_1_t.jpg"))
                    }
                    put(AMOLED_DEFAULT_POSTER)
                }

                val item = JSONObject().apply {
                    put("id", "xn_$vid")
                    put("raw_id", vid)
                    put("title", title)
                    put("duration", duration)
                    put("views", "210K vistas")
                    put("rating", "96%")
                    put("author", "@XNXXStar")
                    put("thumb", thumb)
                    put("thumbs", thumbsArr)
                    put("url", "https://www.xnxx.com/video-$vid")
                    put("embed_url", "https://www.xnxx.com/embedframe/$vid")
                    put("media_url", "")
                    put("source", "XNXX")
                    put("type", "video")
                    put("quality", "1080p HD")
                }
                list.put(item)
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error fetching XNXX: ${e.message}")
        }
        return list
    }

    private fun fetchPhotos(query: String, category: String, page: Int): JSONArray {
        val list = JSONArray()
        val cleanTag = when {
            query.isNotBlank() -> query.trim().lowercase().replace(" ", "_")
            category.isNotBlank() && category != "photos" && category != "hentai" -> category.trim().lowercase().replace(" ", "_")
            else -> "rating:questionable"
        }

        // 1. Try Yande.re Booru API
        try {
            val yandeUrl = "https://yande.re/post.json?limit=25&page=$page&tags=${Uri.encode(cleanTag)}"
            val req = Request.Builder()
                .url(yandeUrl)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .header("Accept", "application/json, text/plain, */*")
                .build()

            val resp = client.newCall(req).execute()
            val body = resp.body?.string() ?: ""
            if (body.startsWith("[")) {
                val arr = JSONArray(body)
                for (i in 0 until arr.length()) {
                    val p = arr.getJSONObject(i)
                    val id = p.optString("id")
                    if (id.isEmpty()) continue
                    val sampleUrl = p.optString("sample_url").ifEmpty { p.optString("file_url") }
                    val previewUrl = p.optString("preview_url").ifEmpty { sampleUrl }
                    val fileUrl = p.optString("file_url").ifEmpty { sampleUrl }
                    val jpegUrl = p.optString("jpeg_url").ifEmpty { fileUrl }
                    val author = p.optString("author", "Artist").ifEmpty { "Artist" }
                    val score = p.optInt("score", 15)
                    val width = p.optInt("width", 1920)
                    val height = p.optInt("height", 1080)
                    val tags = p.optString("tags", "anime art hot")

                    val titleWords = tags.split(" ")
                        .filter { it.isNotBlank() && !it.startsWith("tagme") }
                        .take(3)
                        .joinToString(" ") { word ->
                            word.replace("_", " ").replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
                        }
                    val title = if (titleWords.isNotBlank()) titleWords else "Foto HD Exclusiva"

                    val item = JSONObject().apply {
                        put("id", "yd_$id")
                        put("raw_id", id)
                        put("title", title)
                        put("duration", "Foto HD")
                        put("views", "${(score * 180 + 3200)} vistas")
                        put("rating", "${minOf(99, 90 + score % 10)}%")
                        put("author", "@$author")
                        put("thumb", previewUrl)
                        put("photo_url", jpegUrl.ifEmpty { sampleUrl })
                        put("media_url", jpegUrl.ifEmpty { sampleUrl })
                        put("embed_url", jpegUrl.ifEmpty { sampleUrl })
                        put("thumbs", JSONArray().apply {
                            put(previewUrl)
                            put(sampleUrl)
                            put(fileUrl)
                            put(AMOLED_DEFAULT_POSTER)
                        })
                        put("source", "Yande.re")
                        put("type", "photo")
                        put("quality", "${width}x${height} HD")
                    }
                    list.put(item)
                }
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error fetching Yande.re photos: ${e.message}")
        }

        // 2. Fallback / supplementary query to Konachan if needed
        if (list.length() < 5) {
            try {
                val kcUrl = "https://konachan.net/post.json?limit=25&page=$page&tags=${Uri.encode(cleanTag)}"
                val req = Request.Builder()
                    .url(kcUrl)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                    .header("Accept", "application/json, text/plain, */*")
                    .build()

                val resp = client.newCall(req).execute()
                val body = resp.body?.string() ?: ""
                if (body.startsWith("[")) {
                    val arr = JSONArray(body)
                    for (i in 0 until arr.length()) {
                        val p = arr.getJSONObject(i)
                        val id = p.optString("id")
                        if (id.isEmpty()) continue
                        val sampleUrl = p.optString("sample_url").ifEmpty { p.optString("file_url") }
                        val previewUrl = p.optString("preview_url").ifEmpty { sampleUrl }
                        val fileUrl = p.optString("file_url").ifEmpty { sampleUrl }
                        val jpegUrl = p.optString("jpeg_url").ifEmpty { fileUrl }
                        val author = p.optString("author", "Artist").ifEmpty { "Artist" }
                        val score = p.optInt("score", 12)
                        val width = p.optInt("width", 1920)
                        val height = p.optInt("height", 1080)
                        val tags = p.optString("tags", "anime art hot")

                        val titleWords = tags.split(" ")
                            .filter { it.isNotBlank() && !it.startsWith("tagme") }
                            .take(3)
                            .joinToString(" ") { word ->
                                word.replace("_", " ").replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
                            }
                        val title = if (titleWords.isNotBlank()) titleWords else "Foto HD Exclusiva"

                        val item = JSONObject().apply {
                            put("id", "kc_$id")
                            put("raw_id", id)
                            put("title", title)
                            put("duration", "Foto HD")
                            put("views", "${(score * 150 + 2800)} vistas")
                            put("rating", "${minOf(99, 92 + score % 8)}%")
                            put("author", "@$author")
                            put("thumb", previewUrl)
                            put("photo_url", jpegUrl.ifEmpty { sampleUrl })
                            put("media_url", jpegUrl.ifEmpty { sampleUrl })
                            put("embed_url", jpegUrl.ifEmpty { sampleUrl })
                            put("thumbs", JSONArray().apply {
                                put(previewUrl)
                                put(sampleUrl)
                                put(fileUrl)
                                put(AMOLED_DEFAULT_POSTER)
                            })
                            put("source", "Konachan")
                            put("type", "photo")
                            put("quality", "${width}x${height} HD")
                        }
                        list.put(item)
                    }
                }
            } catch (e: Exception) {
                Log.e("All18Api", "Error fetching Konachan photos: ${e.message}")
            }
        }

        // 3. Fallback to curated booru items if network empty
        if (list.length() == 0) {
            val curated = getCuratedFallbackPhotos()
            for (i in 0 until curated.length()) {
                list.put(curated.getJSONObject(i))
            }
        }

        return list
    }

    private fun getCuratedFallbackPhotos(): JSONArray {
        val list = JSONArray()
        val samples = listOf(
            Triple("1268547", "Yande.re", "Goddess Victory Exclusive Art"),
            Triple("1268540", "Yande.re", "Sensual Anime Artwork 4K"),
            Triple("408253", "Konachan", "Fantasy Maiden Special HD"),
            Triple("408250", "Konachan", "Cosplay Anime Art Collection")
        )
        for ((rawId, src, title) in samples) {
            val isYd = src == "Yande.re"
            val prefix = if (isYd) "yd_" else "kc_"
            val thumb = AMOLED_DEFAULT_POSTER
            val item = JSONObject().apply {
                put("id", "$prefix$rawId")
                put("raw_id", rawId)
                put("title", title)
                put("duration", "Foto HD")
                put("views", "38K vistas")
                put("rating", "98%")
                put("author", "@OfficialArtist")
                put("thumb", thumb)
                put("photo_url", thumb)
                put("media_url", thumb)
                put("embed_url", thumb)
                put("thumbs", JSONArray().apply { put(thumb); put(AMOLED_DEFAULT_POSTER) })
                put("source", src)
                put("type", "photo")
                put("quality", "1920x1080 HD")
            }
            list.put(item)
        }
        return list
    }

    private fun fetchEporner(query: String, page: Int): JSONArray {
        val list = JSONArray()
        val cleanQuery = if (query.isBlank()) "trending" else query
        val url = "https://www.eporner.com/api/v2/video/search/?query=${Uri.encode(cleanQuery)}&per_page=20&page=$page"

        try {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .header("Accept", "application/json, text/plain, */*")
                .build()

            val resp = client.newCall(req).execute()
            val body = resp.body?.string() ?: return list
            val json = JSONObject(body)
            val videos = json.optJSONArray("videos") ?: return list

            for (i in 0 until videos.length()) {
                val v = videos.getJSONObject(i)
                val id = v.optString("id")
                if (id.isEmpty()) continue
                val title = v.optString("title", "Video Eporner")
                val views = v.optInt("views", 12000)
                val viewsStr = if (views > 1_000_000) "${views / 1_000_000}M" else "${views / 1000}K"
                val lengthMin = v.optString("length_min", "10:00")
                val embedUrl = v.optString("embed", "https://www.eporner.com/embed/$id/")
                val defaultThumb = v.optJSONObject("default_thumb")?.optString("src") ?: ""
                val thumbsArr = JSONArray()
                if (defaultThumb.isNotEmpty()) thumbsArr.put(defaultThumb)
                val vThumbs = v.optJSONArray("thumbs")
                if (vThumbs != null) {
                    for (t in 0 until minOf(4, vThumbs.length())) {
                        val tSrc = vThumbs.getJSONObject(t).optString("src")
                        if (tSrc.isNotEmpty() && tSrc != defaultThumb) thumbsArr.put(tSrc)
                    }
                }
                thumbsArr.put(AMOLED_DEFAULT_POSTER)

                val item = JSONObject().apply {
                    put("id", "ep_$id")
                    put("raw_id", id)
                    put("title", title)
                    put("duration", lengthMin)
                    put("views", "$viewsStr vistas")
                    put("rating", "98%")
                    put("author", "@EpornerCreator")
                    put("thumb", defaultThumb.ifEmpty { AMOLED_DEFAULT_POSTER })
                    put("thumbs", thumbsArr)
                    put("url", "https://www.eporner.com/embed/$id/")
                    put("embed_url", embedUrl)
                    put("media_url", "")
                    put("source", "Eporner")
                    put("type", "video")
                    put("quality", "1080p 60fps")
                }
                list.put(item)
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error fetching Eporner: ${e.message}")
        }
        return list
    }

    private fun createJsonResponse(jsonString: String): WebResourceResponse {
        val data = jsonString.toByteArray(Charsets.UTF_8)
        val headers = mapOf(
            "Access-Control-Allow-Origin" to "*",
            "Access-Control-Allow-Methods" to "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" to "*",
            "Content-Type" to "application/json; charset=utf-8"
        )
        return WebResourceResponse(
            "application/json",
            "UTF-8",
            200,
            "OK",
            headers,
            ByteArrayInputStream(data)
        )
    }
}
