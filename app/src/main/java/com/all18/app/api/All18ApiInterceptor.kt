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
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern
import android.text.Html

class All18ApiInterceptor(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    private val mediaClient = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .connectionPool(okhttp3.ConnectionPool(10, 2, TimeUnit.MINUTES))
        .build()

    private var redGifsToken: String? = null
    private var redGifsExpires: Long = 0L

    fun shouldIntercept(request: WebResourceRequest): WebResourceResponse? {
        val uri = request.url
        val host = uri.host ?: ""
        val path = uri.path ?: ""

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
            val reqBuilder = Request.Builder().url(request.url.toString())
            for ((key, value) in request.requestHeaders) {
                if (!key.equals("Origin", ignoreCase = true) && !key.equals("Referer", ignoreCase = true)) {
                    reqBuilder.header(key, value)
                }
            }
            reqBuilder.header("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile")
            val resp = client.newCall(reqBuilder.build()).execute()
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
                if (kLower != "referer" && kLower != "origin") {
                    reqBuilder.header(key, value)
                }
            }

            // Impersonate legitimate RedGifs web client to eliminate 403 Forbidden
            reqBuilder.header("Referer", "https://www.redgifs.com/")
            reqBuilder.header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")

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

    private fun getSearchResponse(q: String, category: String, source: String, page: Int, filter: String): WebResourceResponse {
        // Direct ID lookup support (e.g. from watch.html)
        if (q.startsWith("ph_") || q.startsWith("rt_") || q.startsWith("rg_") || q.startsWith("xv_") || q.startsWith("xn_") || q.startsWith("yp_")) {
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
            else -> { // "all"
                val phItems = fetchPornhub(queryTerm, page, filter)
                val xvItems = fetchXVideos(queryTerm, page)
                val xnItems = fetchXNXX(queryTerm, page)
                val rtItems = fetchRedTube(queryTerm, page)
                val rgItems = fetchRedGifs(queryTerm, page)

                val maxLen = maxOf(phItems.length(), xvItems.length(), xnItems.length(), rtItems.length(), rgItems.length())
                for (i in 0 until maxLen) {
                    if (i < phItems.length()) allItems.put(phItems.getJSONObject(i))
                    if (i < xvItems.length()) allItems.put(xvItems.getJSONObject(i))
                    if (i < xnItems.length()) allItems.put(xnItems.getJSONObject(i))
                    if (i < rtItems.length()) allItems.put(rtItems.getJSONObject(i))
                    if (i < rgItems.length()) allItems.put(rgItems.getJSONObject(i))
                }
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

    private fun createDirectItemFromId(id: String): JSONObject? {
        return when {
            id.startsWith("ph_") -> {
                val rawId = id.removePrefix("ph_")
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video All18")
                    put("duration", "10:00")
                    put("views", "180K vistas")
                    put("rating", "96%")
                    put("author", "@PornhubStar")
                    put("thumb", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600")
                    put("thumbs", JSONArray().put("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600"))
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
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video XVideos")
                    put("duration", "12:30")
                    put("views", "320K vistas")
                    put("rating", "97%")
                    put("author", "@XVideosStar")
                    put("thumb", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600")
                    put("thumbs", JSONArray().put("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600"))
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
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video XNXX")
                    put("duration", "11:15")
                    put("views", "290K vistas")
                    put("rating", "96%")
                    put("author", "@XNXXStar")
                    put("thumb", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600")
                    put("thumbs", JSONArray().put("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600"))
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
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video YouPorn")
                    put("duration", "14:20")
                    put("views", "210K vistas")
                    put("rating", "95%")
                    put("author", "@YouPornStar")
                    put("thumb", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600")
                    put("thumbs", JSONArray().put("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600"))
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
                JSONObject().apply {
                    put("id", id)
                    put("raw_id", rawId)
                    put("title", "Video All18")
                    put("duration", "08:45")
                    put("views", "150K vistas")
                    put("rating", "94%")
                    put("author", "@RedTubeStar")
                    put("thumb", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600")
                    put("thumbs", JSONArray().put("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600"))
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
                    put("thumbs", JSONArray().put("https://media.redgifs.com/$rawId-poster.jpg"))
                    put("media_url", "https://media.redgifs.com/$rawId.mp4")
                    put("embed_url", "https://www.redgifs.com/ifr/$rawId?autoplay=1")
                    put("source", "RedGifs")
                    put("type", "short")
                    put("quality", "1080p 60fps")
                }
            }
            else -> null
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
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile")
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
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36")
                .build()

            val resp = client.newCall(req).execute()
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
        var search = if (query.isBlank()) "hot trending" else query
        if (filter == "toprated") search += " top"
        val url = "https://www.pornhub.com/webmasters/search?search=${Uri.encode(search)}&page=$page&thumbsize=large&output=json"

        try {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0")
                .build()

            val resp = client.newCall(req).execute()
            val body = resp.body?.string() ?: return list
            val json = JSONObject(body)
            val videos = json.optJSONArray("videos") ?: return list

            for (i in 0 until videos.length()) {
                val v = videos.getJSONObject(i)
                val vid = v.optString("video_id")
                if (vid.isEmpty()) continue

                val thumbsArr = JSONArray()
                val rawThumbs = v.optJSONArray("thumbs")
                if (rawThumbs != null) {
                    for (j in 0 until rawThumbs.length()) {
                        val tObj = rawThumbs.optJSONObject(j)
                        val src = tObj?.optString("src") ?: rawThumbs.optString(j)
                        if (!src.isNullOrEmpty()) thumbsArr.put(src)
                    }
                }
                val defaultThumb = v.optString("default_thumb").ifEmpty { v.optString("thumb") }
                if (thumbsArr.length() == 0 && defaultThumb.isNotEmpty()) {
                    thumbsArr.put(defaultThumb)
                }
                val mainThumb = if (defaultThumb.isNotEmpty()) defaultThumb else (if (thumbsArr.length() > 0) thumbsArr.getString(0) else "")

                val views = v.optInt("views", 25000)
                val viewsStr = if (views > 1_000_000) "${views / 1_000_000}M" else "${views / 1000}K"

                val item = JSONObject()
                item.put("id", "ph_$vid")
                item.put("raw_id", vid)
                item.put("title", v.optString("title").ifEmpty { "Video All18" })
                item.put("duration", v.optString("duration").ifEmpty { "10:00" })
                item.put("views", "$viewsStr vistas")
                item.put("rating", v.optString("rating") + "%")
                item.put("author", "@PornhubStar")
                item.put("thumb", mainThumb)
                item.put("thumbs", thumbsArr)
                item.put("url", v.optString("url"))
                item.put("embed_url", "https://www.pornhub.com/embed/$vid")
                item.put("media_url", "")
                item.put("source", "Pornhub")
                item.put("type", "video")
                item.put("quality", "1080p HD")
                list.put(item)
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error fetching Pornhub: ${e.message}")
        }
        return list
    }

    private fun fetchRedTube(query: String, page: Int): JSONArray {
        val list = JSONArray()
        val search = if (query.isBlank()) "hot" else query
        val url = "https://api.redtube.com/?data=redtube.Videos.searchVideos&output=json&search=${Uri.encode(search)}&page=$page&thumbsize=big"

        try {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0")
                .build()

            val resp = client.newCall(req).execute()
            val body = resp.body?.string() ?: return list
            val json = JSONObject(body)
            val videos = json.optJSONArray("videos") ?: return list

            for (i in 0 until videos.length()) {
                val wrap = videos.getJSONObject(i)
                val v = wrap.optJSONObject("video") ?: wrap
                val vid = v.optString("video_id")
                if (vid.isEmpty()) continue

                val thumbsArr = JSONArray()
                val rawThumbs = v.optJSONArray("thumbs")
                if (rawThumbs != null) {
                    for (j in 0 until rawThumbs.length()) {
                        val tObj = rawThumbs.optJSONObject(j)
                        val src = tObj?.optString("src") ?: rawThumbs.optString(j)
                        if (!src.isNullOrEmpty()) thumbsArr.put(src)
                    }
                }
                val defaultThumb = v.optString("default_thumb").ifEmpty { v.optString("thumb") }
                if (thumbsArr.length() == 0 && defaultThumb.isNotEmpty()) {
                    thumbsArr.put(defaultThumb)
                }
                val mainThumb = if (defaultThumb.isNotEmpty()) defaultThumb else (if (thumbsArr.length() > 0) thumbsArr.getString(0) else "")

                val views = v.optInt("views", 18000)
                val viewsStr = if (views > 1_000_000) "${views / 1_000_000}M" else "${views / 1000}K"

                val item = JSONObject()
                item.put("id", "rt_$vid")
                item.put("raw_id", vid)
                item.put("title", v.optString("title").ifEmpty { "Video All18" })
                item.put("duration", v.optString("duration").ifEmpty { "08:45" })
                item.put("views", "$viewsStr vistas")
                item.put("rating", v.optString("rating") + "%")
                item.put("author", "@RedTubeStar")
                item.put("thumb", mainThumb)
                item.put("thumbs", thumbsArr)
                item.put("url", v.optString("url"))
                item.put("embed_url", "https://embed.redtube.com/?id=$vid")
                item.put("media_url", "")
                item.put("source", "RedTube")
                item.put("type", "video")
                item.put("quality", "720p HD")
                list.put(item)
            }
        } catch (e: Exception) {
            Log.e("All18Api", "Error fetching RedTube: ${e.message}")
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
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .build()

            val resp = client.newCall(req).execute()
            val html = resp.body?.string() ?: return list

            val regex = Pattern.compile("class=\"thumb-inside\">.*?<a href=\"/video\\.([a-zA-Z0-9_-]+)/[^\"]*\".*?data-src=\"([^\"]+)\"(?:.*?title=\"([^\"]+)\")?(?:.*?<span class=\"duration\">([^<]+)</span>)?", Pattern.DOTALL)
            val matcher = regex.matcher(html)

            while (matcher.find()) {
                val vid = matcher.group(1) ?: continue
                val thumb = matcher.group(2) ?: ""
                val rawTitle = matcher.group(3) ?: "Video XVideos"
                val duration = matcher.group(4)?.trim() ?: "10 min"
                val title = Html.fromHtml(rawTitle, Html.FROM_HTML_MODE_LEGACY).toString()

                val item = JSONObject().apply {
                    put("id", "xv_$vid")
                    put("raw_id", vid)
                    put("title", title)
                    put("duration", duration)
                    put("views", "260K vistas")
                    put("rating", "97%")
                    put("author", "@XVideosStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().put(thumb))
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
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .build()

            val resp = client.newCall(req).execute()
            val html = resp.body?.string() ?: return list

            val regex = Pattern.compile("class=\"thumb-inside\">.*?<a href=\"/video-([a-zA-Z0-9_-]+)/[^\"]*\".*?data-src=\"([^\"]+)\"(?:.*?title=\"([^\"]+)\")?", Pattern.DOTALL)
            val matcher = regex.matcher(html)

            while (matcher.find()) {
                val vid = matcher.group(1) ?: continue
                val thumb = matcher.group(2) ?: ""
                val rawTitle = matcher.group(3) ?: "Video XNXX"
                val title = Html.fromHtml(rawTitle, Html.FROM_HTML_MODE_LEGACY).toString()

                val item = JSONObject().apply {
                    put("id", "xn_$vid")
                    put("raw_id", vid)
                    put("title", title)
                    put("duration", "12 min")
                    put("views", "210K vistas")
                    put("rating", "96%")
                    put("author", "@XNXXStar")
                    put("thumb", thumb)
                    put("thumbs", JSONArray().put(thumb))
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
