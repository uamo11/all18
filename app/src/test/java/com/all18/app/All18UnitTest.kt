package com.all18.app

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
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
            put("thumb", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600")
            put("url", "https://www.pornhub.com/embed/65a83a21b8f01")
            put("embed_url", "https://www.pornhub.com/embed/65a83a21b8f01")
            put("source", "Pornhub")
            put("type", "video")
        }

        assertEquals("ph_65a83a21b8f01", item.getString("id"))
        assertEquals("Pornhub", item.getString("source"))
        assertTrue(item.getString("embed_url").contains("/embed/"))
        assertTrue(item.getString("thumb").startsWith("http"))
    }
}
