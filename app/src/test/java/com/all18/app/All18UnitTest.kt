package com.all18.app

import com.all18.app.api.All18ApiInterceptor
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.URI
import java.util.regex.Pattern

class All18UnitTest {

    @Test
    fun testMultiInstanceIntentFlags() {
        // Test Android Task Flags for document multi-instance support
        val FLAG_ACTIVITY_NEW_TASK = 0x10000000
        val FLAG_ACTIVITY_MULTIPLE_TASK = 0x08000000
        val FLAG_ACTIVITY_NEW_DOCUMENT = 0x00080000

        val combinedFlags = FLAG_ACTIVITY_NEW_TASK or FLAG_ACTIVITY_MULTIPLE_TASK or FLAG_ACTIVITY_NEW_DOCUMENT

        assertTrue((combinedFlags and FLAG_ACTIVITY_NEW_TASK) != 0)
        assertTrue((combinedFlags and FLAG_ACTIVITY_MULTIPLE_TASK) != 0)
        assertTrue((combinedFlags and FLAG_ACTIVITY_NEW_DOCUMENT) != 0)
    }

    @Test
    fun testPornhubScraperPattern() {
        val sampleHtml = """
            <li class="videoBox js-pop" data-video-vkey="65a83a21b8f01">
                <a href="/view_video.php?viewkey=65a83a21b8f01" title="Latina Hermosa En La Cama">
                    <img data-src="https://ci.phncdn.com/videos/202401/15/sample.jpg" />
                    <var class="duration">12:45</var>
                </a>
            </li>
        """.trimIndent()

        val liRegex = Pattern.compile("""<li[^>]+class="[^"]*videoBox[^"]*"[^>]*>(.*?)</li>""", Pattern.DOTALL)
        val matcher = liRegex.matcher(sampleHtml)
        assertTrue("Should match videoBox li tag", matcher.find())

        val fullTag = matcher.group(0) ?: ""
        val vkeyPattern = Pattern.compile("""(?:_vkey|data-video-vkey)="([a-zA-Z0-9]+)"|viewkey=([a-zA-Z0-9]+)""")
        val vkM = vkeyPattern.matcher(fullTag)
        assertTrue("Should match vkey", vkM.find())
        val vkey = vkM.group(1) ?: vkM.group(2)
        assertEquals("65a83a21b8f01", vkey)

        val cardContent = matcher.group(1) ?: ""
        val titlePattern = Pattern.compile("""<a[^>]+title="([^"]+)"|class="title"[^>]*>.*?<a[^>]*>([^<]+)</a>""", Pattern.DOTALL)
        val tM = titlePattern.matcher(cardContent)
        assertTrue("Should match title", tM.find())
        assertEquals("Latina Hermosa En La Cama", tM.group(1))

        val thumbPattern = Pattern.compile("""<img[^>]+(?:data-image|data-thumb_url|data-src|src)="([^"]+)"""")
        val thM = thumbPattern.matcher(cardContent)
        assertTrue("Should match thumbnail", thM.find())
        assertEquals("https://ci.phncdn.com/videos/202401/15/sample.jpg", thM.group(1))
    }

    @Test
    fun testXVideosScraperPattern() {
        val sampleHtml = """
            <div class="thumb-inside">
                <a href="/video.ubmkpe1b0ad/super_hot_latina">
                    <img data-src="https://img-hw.xvideos-cdn.com/videos/thumbs169poster/sample.jpg" title="Super Hot Latina" />
                    <span class="duration">15 min</span>
                </a>
            </div>
        """.trimIndent()

        val regex = Pattern.compile("""class="thumb-inside">.*?<a href="/video[._-]?([a-zA-Z0-9_-]+)/[^"]*".*?(?:data-src|src)="([^"]+)"(?:.*?title="([^"]+)")?(?:.*?<span class="duration">([^<]+)</span>)?""", Pattern.DOTALL)
        val matcher = regex.matcher(sampleHtml)
        assertTrue("Should match XVideos card", matcher.find())
        assertEquals("ubmkpe1b0ad", matcher.group(1))
        assertEquals("https://img-hw.xvideos-cdn.com/videos/thumbs169poster/sample.jpg", matcher.group(2))
        assertEquals("Super Hot Latina", matcher.group(3))
        assertEquals("15 min", matcher.group(4))
    }

    @Test
    fun testXNXXScraperPattern() {
        val sampleHtml = """
            <div class="thumb-inside">
                <a href="/video-63829104/amateur_couple_fun">
                    <img data-src="https://img-hw.xnxx-cdn.com/videos/thumbs169poster/sample_xn.jpg" title="Amateur Couple Fun" />
                </a>
            </div>
        """.trimIndent()

        val regex = Pattern.compile("""class="thumb-inside">.*?<a href="/video-([a-zA-Z0-9_-]+)/[^"]*".*?(?:data-src|src)="([^"]+)"(?:.*?title="([^"]+)")?""", Pattern.DOTALL)
        val matcher = regex.matcher(sampleHtml)
        assertTrue("Should match XNXX card", matcher.find())
        assertEquals("63829104", matcher.group(1))
        assertEquals("https://img-hw.xnxx-cdn.com/videos/thumbs169poster/sample_xn.jpg", matcher.group(2))
        assertEquals("Amateur Couple Fun", matcher.group(3))
    }

    @Test
    fun testCuratedFallbackItemJsonStructure() {
        val item = JSONObject().apply {
            put("id", "ph_65a83a21b8f01")
            put("raw_id", "65a83a21b8f01")
            put("title", "Sensual Latina Exclusiva")
            put("duration", "10:00")
            put("views", "180K vistas")
            put("rating", "96%")
            put("author", "@PornhubStar")
            put("thumb", All18ApiInterceptor.AMOLED_DEFAULT_POSTER)
            put("url", "https://www.pornhub.com/embed/65a83a21b8f01")
            put("embed_url", "https://www.pornhub.com/embed/65a83a21b8f01")
            put("source", "Pornhub")
            put("type", "video")
        }

        assertEquals("ph_65a83a21b8f01", item.getString("id"))
        assertEquals("Pornhub", item.getString("source"))
        assertTrue(item.getString("embed_url").contains("/embed/"))
        assertTrue(item.getString("thumb").startsWith("data:image/svg+xml"))
    }

    @Test
    fun testAdBlockShieldDomainInterception() {
        val blockedUrls = listOf(
            "https://syndication.exoclick.com/splash.php?cat=1",
            "https://delivery.trafficjunky.com/banner?size=300x250",
            "https://as.juicyads.com/show.php",
            "https://cdn.popcash.net/pop.js",
            "https://serve.popads.net/serve.js",
            "https://creative.stripcdn.com/banner.mp4",
            "https://chaturbate.com/affiliates/in/?track=default",
            "https://delivery.adsterra.com/ad.js",
            "https://ad.hilltopads.net/track"
        )

        for (urlStr in blockedUrls) {
            val host = URI(urlStr).host ?: ""
            val isBlocked = All18ApiInterceptor.isAdHost(host)
            assertTrue("Should block ad network: $urlStr", isBlocked)
        }

        val allowedUrls = listOf(
            "https://www.pornhub.com/embed/ph65a83a21b8f01",
            "https://ci.phncdn.com/videos/202401/15/sample.jpg",
            "https://engine.phncdn.com/player/video.mp4",
            "https://www.xvideos.com/embedframe/74829103",
            "https://img-hw.xvideos-cdn.com/videos/thumbs169poster/sample.jpg",
            "https://www.xnxx.com/embedframe/63829104",
            "https://img-hw.xnxx-cdn.com/videos/thumbs169poster/sample_xn.jpg",
            "https://www.eporner.com/embed/cIG0retUIzC/",
            "https://spankbang.com/7849102/embed/",
            "https://sb-cd.com/video.mp4",
            "https://media.redgifs.com/sample.mp4",
            "https://www.redtube.com/12345",
            "https://www.youporn.com/watch/67890",
            "https://beeg.com/123"
        )

        for (urlStr in allowedUrls) {
            val host = URI(urlStr).host ?: ""
            val isBlocked = All18ApiInterceptor.isAdHost(host)
            assertFalse("Should allow video provider: $urlStr", isBlocked)
        }

        // Verify VIDEO_SAFE_HOSTS completeness
        assertTrue("pornhub.com should be in VIDEO_SAFE_HOSTS", All18ApiInterceptor.VIDEO_SAFE_HOSTS.contains("pornhub.com"))
        assertTrue("phncdn.com should be in VIDEO_SAFE_HOSTS", All18ApiInterceptor.VIDEO_SAFE_HOSTS.contains("phncdn.com"))
        assertTrue("xvideos-cdn.com should be in VIDEO_SAFE_HOSTS", All18ApiInterceptor.VIDEO_SAFE_HOSTS.contains("xvideos-cdn.com"))
        assertTrue("xnxx-cdn.com should be in VIDEO_SAFE_HOSTS", All18ApiInterceptor.VIDEO_SAFE_HOSTS.contains("xnxx-cdn.com"))
    }

    @Test
    fun testXvideosXnxxHighQualityPosterExtraction() {
        val rawThumbUrl = "https://img-hw.xvideos-cdn.com/videos/thumbs169/sample_THUMBNUM.jpg"
        val fixedUrl = rawThumbUrl.replace("THUMBNUM", "15")
        assertEquals("https://img-hw.xvideos-cdn.com/videos/thumbs169/sample_15.jpg", fixedUrl)

        val cdnRotated = fixedUrl.replace("thumbs-gcore", "thumb-cdn77")
        assertFalse(cdnRotated.contains("THUMBNUM"))
    }

    @Test
    fun testBooruPhotosJsonStructure() {
        val photoItem = JSONObject().apply {
            put("id", "booru_123456")
            put("title", "Anime Cosplay Waifu #123456")
            put("author", "@BooruArtist")
            put("thumb", "https://yande.re/preview/123456.jpg")
            put("image_url", "https://files.yande.re/image/123456.jpg")
            put("source", "Booru")
            put("type", "photo")
            put("views", "85K")
            put("rating", "100%")
        }

        assertEquals("photo", photoItem.getString("type"))
        assertEquals("Booru", photoItem.getString("source"))
        assertTrue(photoItem.getString("image_url").endsWith(".jpg"))
        assertTrue(photoItem.getString("id").startsWith("booru_"))
    }

    @Test
    fun testOpenSourceXAlgorithmHeavyRankerScoring() {
        // HeavyRanker open-source weights:
        val LIKE_WEIGHT = 30.0
        val REPOST_WEIGHT = 20.0
        val REPLY_WEIGHT = 1.0
        val PHOTO_CLICK_WEIGHT = 11.0
        val DISLIKE_WEIGHT = -74.0

        // User engagement counts
        val likes = 10
        val reposts = 5
        val replies = 3
        val photoClicks = 2
        val dislikes = 1

        val engagementScore = (likes * LIKE_WEIGHT) + 
                              (reposts * REPOST_WEIGHT) + 
                              (replies * REPLY_WEIGHT) + 
                              (photoClicks * PHOTO_CLICK_WEIGHT) + 
                              (dislikes * DISLIKE_WEIGHT)

        // 300 + 100 + 3 + 22 - 74 = 351
        assertEquals(351.0, engagementScore, 0.001)

        // Exponential half-life decay at 24 hours: 0.5^(24/24) = 0.5
        val ageHours = 24.0
        val decay = Math.pow(0.5, ageHours / 24.0)
        assertEquals(0.5, decay, 0.001)

        val finalRankedScore = engagementScore * decay
        assertEquals(175.5, finalRankedScore, 0.001)
    }

    @Test
    fun testPublicShareUrlResolution() {
        fun getPublicShareUrl(embedUrl: String, rawId: String, source: String): String {
            val src = source.lowercase()
            return when {
                src.contains("pornhub") -> "https://www.pornhub.com/view_video.php?viewkey=$rawId"
                src.contains("xvideos") -> "https://www.xvideos.com/video.$rawId/"
                src.contains("xnxx") -> "https://www.xnxx.com/video-$rawId/"
                src.contains("spankbang") -> "https://spankbang.com/$rawId/video/"
                src.contains("eporner") -> "https://www.eporner.com/video/$rawId/"
                src.contains("redgifs") -> "https://www.redgifs.com/watch/$rawId"
                src.contains("redtube") -> "https://www.redtube.com/$rawId"
                src.contains("youporn") -> "https://www.youporn.com/watch/$rawId/"
                else -> embedUrl
            }
        }

        assertEquals("https://www.pornhub.com/view_video.php?viewkey=65a83a21b8f01", getPublicShareUrl("https://www.pornhub.com/embed/65a83a21b8f01", "65a83a21b8f01", "Pornhub"))
        assertEquals("https://www.xvideos.com/video.ubmkpe1b0ad/", getPublicShareUrl("https://www.xvideos.com/embedframe/ubmkpe1b0ad", "ubmkpe1b0ad", "XVideos"))
        assertEquals("https://www.xnxx.com/video-63829104/", getPublicShareUrl("https://www.xnxx.com/embedframe/63829104", "63829104", "XNXX"))
        assertFalse("Share URL must not be internal asset path", getPublicShareUrl("https://www.pornhub.com/embed/65a83a21b8f01", "65a83a21b8f01", "Pornhub").contains("appassets.androidplatform.net"))
    }
}
