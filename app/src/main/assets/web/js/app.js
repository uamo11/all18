/**
 * All18 - Frontend Application Logic & Theme Engine
 * Theme: Pornhub Tube (Orange/Dark)
 */

(function () {
    'use strict';

    // Application State
    const state = {
        page: 1,
        query: '',
        category: '',
        source: 'all',
        filter: 'trending',
        view: 'videos',
        loading: false,
        items: [],
        favorites: JSON.parse(localStorage.getItem('all18_favorites') || '[]'),
        activeModalItem: null,
        publishMode: 'link',
        generatedThumbnail: null,
        uploadedVideoBlob: null,
        searchSessionId: 0
    };

    // DOM Elements
    const elements = {
        grid: document.getElementById('mediaGrid'),
        loadMoreBtn: document.getElementById('btnLoadMore'),
        searchForm: document.getElementById('searchForm'),
        searchInput: document.getElementById('searchInput'),
        categoriesBar: document.getElementById('categoriesBar'),
        sourceSelect: document.getElementById('sourceSelect'),
        qualitySelect: document.getElementById('qualitySelect'),
        durationSelect: document.getElementById('durationSelect'),
        filterBtns: document.querySelectorAll('.filter-btn'),
        navLinks: document.querySelectorAll('.nav-link'),
        toolbarTitle: document.getElementById('toolbarTitle'),
        itemCount: document.getElementById('itemCount'),
        favCountBadge: document.getElementById('favCountBadge'),
        
        // Modal
        videoModal: document.getElementById('videoModal'),
        modalCloseBtn: document.getElementById('modalCloseBtn'),
        modalPlayerContainer: document.getElementById('modalPlayerContainer'),
        modalTitle: document.getElementById('modalTitle'),
        modalAuthor: document.getElementById('modalAuthor'),
        modalSource: document.getElementById('modalSource'),
        modalViews: document.getElementById('modalViews'),
        modalRating: document.getElementById('modalRating'),
        modalTags: document.getElementById('modalTags'),
        modalShareBtn: document.getElementById('modalShareBtn'),
        modalFavBtn: document.getElementById('modalFavBtn'),
        
        // Publish Modal
        btnOpenPublish: document.getElementById('btnOpenPublish'),
        publishModal: document.getElementById('publishModal'),
        publishCloseBtn: document.getElementById('publishCloseBtn'),
        publishForm: document.getElementById('publishForm'),
        tabLinkBtn: document.getElementById('tabLinkBtn'),
        tabFileBtn: document.getElementById('tabFileBtn'),
        linkInputGroup: document.getElementById('linkInputGroup'),
        fileInputGroup: document.getElementById('fileInputGroup'),
        publishUrl: document.getElementById('publishUrl'),
        publishFile: document.getElementById('publishFile'),
        dropzone: document.getElementById('dropzone'),
        videoFilePreview: document.getElementById('videoFilePreview'),
        previewVideoTag: document.getElementById('previewVideoTag'),
        publishTitle: document.getElementById('publishTitle'),
        publishAuthor: document.getElementById('publishAuthor'),
        publishCategory: document.getElementById('publishCategory'),
        publishTags: document.getElementById('publishTags'),
        btnSubmitPublish: document.getElementById('btnSubmitPublish'),
        thumbCanvas: document.getElementById('thumbCanvas'),
        
        // Age Gate
        ageGate: document.getElementById('welcomeModal'),
        btnWelcomeEnter: document.getElementById('btnWelcomeEnter'),
        btnWelcomeLeave: document.getElementById('btnWelcomeLeave'),
        
        // Theme Menu
        themeDropdownBtn: document.getElementById('themeDropdownBtn'),
        themeMenu: document.getElementById('themeMenu'),
        toastContainer: document.getElementById('toastContainer')
    };

    const DEFAULT_CATEGORIES = [
        { slug: '', name: '🔥 Todo' },
        { slug: 'latina', name: '💃 Latinas' },
        { slug: 'amateur', name: '🎥 Casero / Amateur' },
        { slug: 'verified-models', name: '⭐ Modelos Populares' },
        { slug: 'milf', name: '💄 MILF' },
        { slug: 'big-ass', name: '🍑 Culos Grandes' },
        { slug: 'big-tits', name: '🍒 Tetas Grandes' },
        { slug: 'cosplay', name: '🎭 Cosplay Hot' },
        { slug: 'teen-18', name: '✨ Jovencitas (18+)' },
        { slug: 'blowjob', name: '💋 Oral / Mamadas' },
        { slug: 'creampie', name: '💦 Creampie' },
        { slug: 'anal', name: '🔥 Anal' },
        { slug: 'lesbian', name: '👭 Lesbiana' },
        { slug: 'pov', name: '📹 POV (Primera Persona)' },
        { slug: 'threesome', name: '🔥 Tríos' },
        { slug: 'hardcore', name: '⚡ Hardcore' }
    ];

    function init() {
        const isTikTok = window.location.pathname.includes('tiktok.html') || document.body.classList.contains('tiktok-standalone-body');
        if (isTikTok) {
            state.source = 'redgifs';
            state.view = 'shorts';
            state.page = 1;
            document.body.dataset.theme = 'tiktok';
        }

        try { initTheme(); } catch (e) { console.error('initTheme error:', e); }
        try { setupEventListeners(); } catch (e) { console.error('setupEventListeners error:', e); }
        try { setupPublishEngine(); } catch (e) { console.error('setupPublishEngine error:', e); }
        try { checkAgeGate(); } catch (e) { console.error('checkAgeGate error:', e); }
        try { updateFavoritesBadge(); } catch (e) { console.error('updateFavoritesBadge error:', e); }
        try { setGridDensity(localStorage.getItem('all18_grid_density') || '2', false); } catch (e) {}
        try { renderCategories(DEFAULT_CATEGORIES); } catch (e) { console.error('renderCategories error:', e); }
        try { loadCategoriesFromAPI(); } catch (e) { console.error('loadCategoriesFromAPI error:', e); }
        try { initFirebase(); } catch (e) { console.error('initFirebase error:', e); }
        try { fetchContent(true); } catch (e) { console.error('fetchContent error:', e); }
        try { checkWatchParamOnLoad(); } catch (e) { console.error('checkWatchParamOnLoad error:', e); }
    }

    function checkWatchParamOnLoad() {
                const urlParams = new URLSearchParams(window.location.search);
        const q = urlParams.get('q');
        if (q) {
            state.query = q;
            if (elements.searchInput) elements.searchInput.value = q;
        }
        
        const viewParam = urlParams.get('view');
        if (viewParam === 'favorites') {
            state.view = 'favorites';
            const catWrapper = document.querySelector('.categories-bar-wrapper');
            if (catWrapper) catWrapper.style.display = 'none';
        }
        const videoId = urlParams.get('v');
        const isWatchPage = window.location.pathname.includes('watch.php') || window.location.pathname.includes('watch.html') || document.body.classList.contains('watch-page-body');

        const isTikTok = window.location.pathname.includes('tiktok.html') || document.body.dataset.theme === 'tiktok';
        if (isTikTok) {
            state.source = 'redgifs';
            state.view = 'shorts';
        }

        if (videoId || isWatchPage) {
            let cachedItem = sessionStorage.getItem('all18_current_watch') || localStorage.getItem('all18_current_watch');
            if (cachedItem) {
                try {
                    const item = JSON.parse(cachedItem);
                    if (!videoId || item.id === videoId) {
                        openWatchView(item, false);
                        return;
                    }
                } catch (e) {}
            }

            const embedParam = urlParams.get('embed');
            if (embedParam) {
                const titleParam = urlParams.get('title') || 'Video All18';
                const sourceParam = urlParams.get('source') || 'Multi-Hub';
                const directItem = {
                    id: videoId || ('ext_' + Date.now()),
                    title: titleParam,
                    source: sourceParam,
                    embed_url: embedParam,
                    author: '@All18Stream',
                    views: 'HD Exclusivo',
                    rating: '99%',
                    category: 'Multi-Hub'
                };
                openWatchView(directItem, false);
                return;
            }

            if (videoId) {
                let directItem = null;
                if (videoId.startsWith('ph_')) {
                    const rawId = videoId.replace('ph_', '');
                    directItem = { id: videoId, raw_id: rawId, title: 'Video All18', source: 'Pornhub', embed_url: 'https://www.pornhub.com/embed/' + rawId, author: '@PornhubStar', views: '240K vistas', rating: '96%', category: 'Latina' };
                } else if (videoId.startsWith('xv_')) {
                    const rawId = videoId.replace('xv_', '');
                    directItem = { id: videoId, raw_id: rawId, title: 'Video XVideos', source: 'XVideos', embed_url: 'https://www.xvideos.com/embedframe/' + rawId, author: '@XVideosStar', views: '320K vistas', rating: '97%', category: 'Destacado' };
                } else if (videoId.startsWith('xn_')) {
                    const rawId = videoId.replace('xn_', '');
                    directItem = { id: videoId, raw_id: rawId, title: 'Video XNXX', source: 'XNXX', embed_url: 'https://www.xnxx.com/embedframe/' + rawId, author: '@XNXXStar', views: '290K vistas', rating: '96%', category: 'Destacado' };
                } else if (videoId.startsWith('yp_')) {
                    const rawId = videoId.replace('yp_', '');
                    directItem = { id: videoId, raw_id: rawId, title: 'Video YouPorn', source: 'YouPorn', embed_url: 'https://www.youporn.com/embed/' + rawId, author: '@YouPornStar', views: '210K vistas', rating: '95%', category: 'Destacado' };
                } else if (videoId.startsWith('rt_')) {
                    const rawId = videoId.replace('rt_', '');
                    directItem = { id: videoId, raw_id: rawId, title: 'Video All18', source: 'RedTube', embed_url: 'https://embed.redtube.com/?id=' + rawId, author: '@RedTubeStar', views: '180K vistas', rating: '94%', category: 'Latina' };
                } else if (videoId.startsWith('rg_')) {
                    const rawId = videoId.replace('rg_', '');
                    directItem = { id: videoId, raw_id: rawId, title: 'Short Clip Hot', source: 'RedGifs', type: 'short', embed_url: 'https://www.redgifs.com/ifr/' + rawId + '?autoplay=1', media_url: 'https://media.redgifs.com/' + rawId + '.mp4', author: '@All18Creator', views: '95K vistas', rating: '98%', category: 'Shorts' };
                }
                if (directItem) {
                    openWatchView(directItem, false);
                }

                fetch(`api.php?action=search&source=all&q=${encodeURIComponent(videoId)}&page=1`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.data && data.data.length > 0) {
                            const found = data.data.find(i => i.id === videoId) || data.data[0];
                            if (found) openWatchView(found, false);
                        }
                    })
                    .catch(() => {});
            }
        }
    }

    function initTheme() {
        const path = window.location.pathname.toLowerCase();
        let targetTheme = 'pornhub';

        if (path.includes('tiktok') || document.body.classList.contains('tiktok-standalone-body')) {
            targetTheme = 'tiktok';
            state.source = 'redgifs';
            state.view = 'shorts';
        } else if (path.includes('twitter') || document.body.classList.contains('twitter-standalone-body')) {
            targetTheme = 'twitter';
            state.source = 'all';
            state.view = 'videos';
        } else if (path.includes('onlyfans')) {
            targetTheme = 'onlyfans';
            state.source = 'all';
            state.view = 'videos';
        } else if (path.includes('instagram')) {
            targetTheme = 'instagram';
            state.source = 'all';
            state.view = 'videos';
        } else {
            targetTheme = 'pornhub';
            state.source = 'all';
            state.view = 'videos';
        }

        window.applyTheme(targetTheme, false);
    }



    function checkAgeGate() {
        const verified = localStorage.getItem('all18_age_verified');
        if (!verified && elements.ageGate) {
            elements.ageGate.classList.add('active');
        }
    }

    async function loadCategoriesFromAPI() {
        try {
            const res = await fetch('api.php?action=categories');
            if (res.ok) {
                const result = await res.json();
                if (result.status === 'success' && result.data) {
                    renderCategories(result.data);
                }
            }
        } catch (e) {
            // fallback used
        }
    }

    function renderCategories(cats) {
        if (!elements.categoriesBar) return;
        elements.categoriesBar.innerHTML = '';
        cats.forEach(c => {
            const btn = document.createElement('button');
            btn.className = `cat-pill ${state.category === c.slug ? 'active' : ''}`;
            btn.textContent = c.name;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                state.category = c.slug;
                // query preserved
                fetchContent(true);
            });
            elements.categoriesBar.appendChild(btn);
        });
    }

    // Direct RedGifs API Client
    let directRedGifsToken = null;
    async function getDirectRedGifsToken() {
        if (directRedGifsToken) return directRedGifsToken;
        try {
            const res = await fetch('https://api.redgifs.com/v2/auth/temporary');
            const data = await res.json();
            directRedGifsToken = data.token;
            return directRedGifsToken;
        } catch (e) {
            return null;
        }
    }

    async function fetchDirectRedGifs(query, page) {
        try {
            const token = await getDirectRedGifsToken();
            if (!token) return [];
            
            let term = query || 'hot';
            if (term.toLowerCase().includes('latina')) term = 'latina';
            if (term.toLowerCase().includes('casero') || term.toLowerCase().includes('amateur')) term = 'amateur';
            if (term.toLowerCase().includes('culos')) term = 'big ass';
            if (term.toLowerCase().includes('tetas')) term = 'big tits';
            if (term.toLowerCase().includes('mamadas')) term = 'blowjob';
            
            const res = await fetch(`https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(term)}&count=24&page=${page}&order=trending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data && data.gifs) {
                return data.gifs
                    .map(g => {
                        const poster = g.urls?.poster || g.urls?.thumbnail || g.urls?.sd || '';
                        const hdUrl = (g.urls?.hd && g.urls.hd.includes('.mp4')) ? g.urls.hd : '';
                        const sdUrl = (g.urls?.sd && g.urls.sd.includes('.mp4')) ? g.urls.sd : '';
                        const silentUrl = (g.urls?.silent && g.urls.silent.includes('.mp4')) ? g.urls.silent : '';
                        const mp4 = sdUrl || hdUrl || silentUrl;

                        if (!mp4) return null;

                        return {
                            id: 'rg_' + g.id,
                            raw_id: g.id,
                            title: g.tags && g.tags.length ? g.tags.slice(0, 4).join(' ') : 'Short Hot Clip',
                            duration: 'Short / GIF',
                            views: (g.views > 1000 ? Math.round(g.views/1000) + 'K' : g.views) + ' vistas',
                            rating: '98%',
                            author: g.userName ? '@' + g.userName : '@All18Creator',
                            thumb: poster,
                            thumbs: [poster],
                            media_url: mp4,
                            hd_url: hdUrl,
                            sd_url: sdUrl,
                            embed_url: `https://www.redgifs.com/ifr/${g.id}?autoplay=1`,
                            source: 'RedGifs',
                            tags: g.tags || ['shorts', 'hot'],
                            type: 'short',
                            quality: '1080p HD'
                        };
                    })
                    .filter(Boolean);
            }
        } catch (e) {
            console.error('Direct RedGifs error:', e);
        }
        return [];
    }

    // Progressive Multi-Stream Content Loader
    
    // =========================================================================
    // ALL18 OPEN-SOURCE ALGORITHM ENGINE (Inspired by X / Twitter HeavyRanker & Multi-App Recommendations)
    // =========================================================================
    const AlgorithmEngine = {
        STORAGE_KEY: 'all18_algorithm_profile_v2',
        SEEN_STORAGE_KEY: 'all18_seen_history_v2',
        
        CATEGORY_POOL: [
            'latina', 'amateur', 'casero', 'modelos', 'milf', 'culos',
            'tetas', 'cosplay', 'jovencitas', 'mamadas', 'creampie',
            'anal', 'lesbiana', 'pov', 'trios', 'hardcore', 'hot', 'viral',
            'hentai', 'booru', 'ecchi', 'anime', 'dance', 'reels'
        ],

        // Exact HeavyRanker & Multi-App Scoring Weights
        WEIGHTS: {
            // X (Twitter) Open-Source HeavyRanker Weights:
            // Like: +30, Retweet: +20, Reply: +1, Dwell: +0.005/ms up to +15,
            // Photo/Media Click: +11, Play 50%: +11, Not Interested / Dislike: -74
            x: {
                like: 30,
                repost: 20,
                reply: 1,
                dwell_ms: 0.005,
                dwell_max: 15,
                photo_click: 11,
                video_play50: 11,
                dislike: -74,
                not_interested: -74,
                follow: 25
            },
            // Instagram: Visual affinity, Saves/Favs, Shares, Photo Clicks
            instagram: {
                like: 10,
                repost: 18,
                reply: 12,
                photo_click: 15,
                favorite: 25,
                follow: 30,
                dislike: -50,
                not_interested: -50
            },
            // TikTok: Completion rate, Fast Skip penalty, Loop boost
            tiktok: {
                like: 12,
                loop: 25,
                watch_complete: 35,
                watch_good: 15,
                skip_fast: -20,
                dislike: -60,
                not_interested: -60,
                follow: 20
            },
            // Multi-Hub & Tube: Click-Through & Quality
            default: {
                like: 15,
                favorite: 20,
                photo_click: 10,
                dwell_ms: 0.003,
                dwell_max: 10,
                dislike: -40,
                not_interested: -40,
                follow: 15
            }
        },

        getActiveContext() {
            const theme = document.body.dataset.theme;
            if (theme === 'twitter' || document.body.classList.contains('twitter-standalone-body')) return 'x';
            if (theme === 'instagram' || document.body.classList.contains('instagram-standalone-body')) return 'instagram';
            if (theme === 'tiktok' || document.body.classList.contains('tiktok-standalone-body')) return 'tiktok';
            return 'default';
        },

        getProfile() {
            try {
                const raw = localStorage.getItem(this.STORAGE_KEY);
                if (raw) return JSON.parse(raw);
            } catch (e) {}
            return {
                tagScores: { 'latina': 12, 'amateur': 10, 'hot': 8, 'hentai': 6 },
                creatorScores: {},
                totalInteractions: 0,
                lastUpdated: Date.now()
            };
        },

        saveProfile(profile) {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(profile));
            } catch (e) {}
        },

        getSeenIds() {
            try {
                const raw = sessionStorage.getItem(this.SEEN_STORAGE_KEY);
                if (raw) return new Set(JSON.parse(raw));
            } catch (e) {}
            return new Set();
        },

        markSeen(id) {
            if (!id) return;
            const seen = this.getSeenIds();
            seen.add(id);
            const arr = Array.from(seen);
            if (arr.length > 300) arr.splice(0, arr.length - 300);
            try {
                sessionStorage.setItem(this.SEEN_STORAGE_KEY, JSON.stringify(arr));
            } catch (e) {}
        },

        extractTags(item) {
            const tags = new Set();
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(t => tags.add(t.toLowerCase().trim()));
            }
            if (item.title) {
                const titleLower = item.title.toLowerCase();
                this.CATEGORY_POOL.forEach(cat => {
                    if (titleLower.includes(cat)) tags.add(cat);
                });
            }
            if (item.type === 'photo' || item.source === 'Booru' || item.source === 'Yande.re') {
                tags.add('hot');
                tags.add('booru');
            }
            if (tags.size === 0) tags.add('trending');
            return Array.from(tags);
        },

        recordEngagement(item, action, metadata = {}) {
            if (!item) return;
            const profile = this.getProfile();
            const tags = this.extractTags(item);
            const author = item.author ? item.author.toLowerCase().replace('@', '') : null;
            const context = metadata.context || this.getActiveContext();
            const weightMap = this.WEIGHTS[context] || this.WEIGHTS.default;

            let weight = 0;
            if (action === 'dwell') {
                const ms = metadata.ms || 1000;
                weight = Math.min(ms * (weightMap.dwell_ms || 0.005), weightMap.dwell_max || 15);
            } else if (weightMap[action] !== undefined) {
                weight = weightMap[action];
            } else {
                weight = 5;
            }

            // Update tag affinities with dynamic decay bounding (-74 to +150)
            tags.forEach(t => {
                profile.tagScores[t] = (profile.tagScores[t] || 0) + weight;
                if (profile.tagScores[t] < -74) profile.tagScores[t] = -74;
                if (profile.tagScores[t] > 150) profile.tagScores[t] = 150;
            });

            // Update creator affinity
            if (author) {
                profile.creatorScores[author] = (profile.creatorScores[author] || 0) + (weight * 0.75);
                if (profile.creatorScores[author] < -74) profile.creatorScores[author] = -74;
                if (profile.creatorScores[author] > 200) profile.creatorScores[author] = 200;
            }

            profile.totalInteractions = (profile.totalInteractions || 0) + 1;
            profile.lastUpdated = Date.now();
            this.saveProfile(profile);
        },

        getTopPreferredTags(count = 2) {
            const profile = this.getProfile();
            const sorted = Object.entries(profile.tagScores)
                .filter(([_, score]) => score > 0)
                .sort((a, b) => b[1] - a[1]);
            
            if (sorted.length === 0) return ['latina', 'amateur'];
            return sorted.slice(0, count).map(e => e[0]);
        },

        getDiscoveryTags(count = 1) {
            const top = new Set(this.getTopPreferredTags(4));
            const available = this.CATEGORY_POOL.filter(c => !top.has(c));
            const shuffled = available.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count);
        },

        scoreAndDiversifyFeed(items, overrideContext = null) {
            if (!items || items.length === 0) return items;
            const profile = this.getProfile();
            const seen = this.getSeenIds();
            const context = overrideContext || this.getActiveContext();
            const isXMode = context === 'x';

            // 1. Filter unseen items if sufficient pool exists
            let candidates = items.filter(item => !seen.has(item.id));
            if (candidates.length < 3) candidates = items;

            // 2. Score candidates with multi-factor scoring
            const scored = candidates.map(item => {
                const tags = this.extractTags(item);
                const author = item.author ? item.author.toLowerCase().replace('@', '') : null;

                let tagAffinity = 0;
                tags.forEach(t => {
                    tagAffinity += (profile.tagScores[t] || 0);
                });

                const creatorAffinity = author && profile.creatorScores[author] ? profile.creatorScores[author] : 0;
                const rawViews = parseInt(item.views) || 5000;
                const viewsBonus = Math.min(rawViews / 15000, 5);
                const explorationJitter = (Math.random() * 5) - 1.0;

                let totalScore = 0;
                let badge = '#ParaTi';

                if (isXMode) {
                    // Open-Source X (HeavyRanker): Exponential 24h half-life time decay
                    const seed = Math.abs(String(item.id || '123').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
                    const ageHours = item.timestamp ? Math.max((Date.now() - item.timestamp) / 3600000, 0.5) : ((seed % 48) + 1);
                    const timeDecay = Math.pow(0.5, ageHours / 24); // 24-hr half-life
                    const inNetworkMultiplier = creatorAffinity > 15 ? 1.4 : 1.0;

                    const baseRanker = (tagAffinity * 0.45) + (creatorAffinity * 0.55) + viewsBonus + explorationJitter;
                    totalScore = baseRanker * timeDecay * inNetworkMultiplier;

                    if (tagAffinity > 25) badge = `𝕏 Para Ti 🔥 (${tags[0] || 'Top'})`;
                    else if (creatorAffinity > 20) badge = `𝕏 Creador Top ⭐`;
                    else if (timeDecay > 0.8) badge = `𝕏 Reciente ⚡`;
                    else badge = `𝕏 HeavyRanker`;
                } else {
                    totalScore = (tagAffinity * 0.5) + (creatorAffinity * 0.35) + viewsBonus + explorationJitter;
                    if (tagAffinity > 20) badge = `#ParaTi 🔥 (${tags[0] || 'Top'})`;
                    else if (creatorAffinity > 15) badge = `#CreadorFavorito ⭐`;
                    else if (viewsBonus > 3) badge = `#Tendencia ⚡`;
                }

                return {
                    ...item,
                    _score: totalScore,
                    _primaryTag: tags[0] || 'general',
                    recommendationBadge: badge
                };
            });

            // 3. Sort by algorithmic ranking descending
            scored.sort((a, b) => b._score - a._score);

            // 4. Interleaving shuffle for topic and creator diversity
            const diversified = [];
            let lastTag = '';
            let lastAuthor = '';
            const remaining = [...scored];

            while (remaining.length > 0) {
                let nextIdx = remaining.findIndex(i => i._primaryTag !== lastTag && i.author !== lastAuthor);
                if (nextIdx === -1) {
                    nextIdx = remaining.findIndex(i => i._primaryTag !== lastTag);
                }
                if (nextIdx === -1) nextIdx = 0;
                const chosen = remaining.splice(nextIdx, 1)[0];
                diversified.push(chosen);
                lastTag = chosen._primaryTag;
                lastAuthor = chosen.author || '';
                this.markSeen(chosen.id);
            }

            return diversified;
        },

        resetAlgorithm() {
            localStorage.removeItem(this.STORAGE_KEY);
            sessionStorage.removeItem(this.SEEN_STORAGE_KEY);
            showToast('✨ Algoritmo de recomendaciones reiniciado');
        }
    };
    window.AlgorithmEngine = AlgorithmEngine;

    const FEED_CACHE_PREFIX = 'all18_feed_cache_v2_';
    let lastFetchCallInfo = { time: 0, key: '' };

    function getFeedCacheKey() {
        const path = window.location.pathname;
        const pageName = path.includes('tiktok.html') ? 'tiktok' : (path.includes('twitter.html') ? 'twitter' : 'tube');
        const theme = document.body.dataset.theme || pageName;
        return `${pageName}_${theme}_${state.source || 'all'}_${state.category || ''}`;
    }

    function saveFeedCache() {
        if (!state.items || state.items.length === 0 || state.query) return;
        try {
            const key = FEED_CACHE_PREFIX + getFeedCacheKey();
            const payload = {
                items: state.items.slice(0, 48),
                scrollY: window.scrollY || window.pageYOffset || 0,
                savedAt: Date.now()
            };
            sessionStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {}
    }

    function tryRestoreFeedCache() {
        if (state.query) return false;
        try {
            const key = FEED_CACHE_PREFIX + getFeedCacheKey();
            const raw = sessionStorage.getItem(key);
            if (raw) {
                const data = JSON.parse(raw);
                if (Array.isArray(data.items) && data.items.length > 0) {
                    const targetGrid = elements.grid || document.getElementById('mediaGrid');
                    if (targetGrid) {
                        targetGrid.innerHTML = '';
                        state.items = [...data.items];
                        renderCards(state.items);
                        const badge = elements.itemCount || document.getElementById('itemCount');
                        if (badge) badge.textContent = `(${state.items.length}+ videos)`;
                        if (data.scrollY > 0) {
                            setTimeout(() => window.scrollTo({ top: data.scrollY, behavior: 'instant' }), 40);
                        }
                        return true;
                    }
                }
            }
        } catch (e) {}
        return false;
    }

    function getCuratedLocalFeed(src) {
        return [
            { id: 'ph_65a83a21b8f01', source: 'Pornhub', title: 'Sensual Latina Exclusiva HD', duration: '12:30', views: '280K vistas', rating: '98%', author: '@PornhubStar', thumb: 'https://ci.phncdn.com/videos/202401/15/sample.jpg', embed_url: 'https://www.pornhub.com/embed/65a83a21b8f01', quality: '1080p HD' },
            { id: 'xv_ommelke9c80', source: 'XVideos', title: 'Hot College Blonde HD Special', duration: '15:20', views: '320K vistas', rating: '97%', author: '@XVideosStar', thumb: 'https://thumbs-gcore.xvideos-cdn.com/videos/thumbs169poster/sample.jpg', embed_url: 'https://www.xvideos.com/embedframe/ommelke9c80', quality: '1080p HD' },
            { id: 'xn_1imfom09', source: 'XNXX', title: 'Top Model Colección Ardiente', duration: '11:45', views: '240K vistas', rating: '96%', author: '@XNXXCreator', thumb: 'https://thumb-cdn77.xnxx-cdn.com/videos/thumbs169poster/sample_xn.jpg', embed_url: 'https://www.xnxx.com/embedframe/1imfom09', quality: '1080p HD' },
            { id: 'rg_sprycaringafricangroundhornbill', source: 'RedGifs', title: 'Short Hot Loop Viral', duration: 'Short', views: '150K vistas', rating: '99%', author: '@All18Creator', thumb: 'https://media.redgifs.com/sprycaringafricangroundhornbill-poster.jpg', media_url: 'https://media.redgifs.com/sprycaringafricangroundhornbill.mp4', embed_url: 'https://www.redgifs.com/ifr/sprycaringafricangroundhornbill', type: 'short', quality: '1080p HD' },
            { id: 'ep_cIG0retUIzC', source: 'Eporner', title: 'Exclusivo Pure 1080p Ultra', duration: '14:10', views: '190K vistas', rating: '99%', author: '@EpornerStar', thumb: 'https://static-eporner.com/sample.jpg', embed_url: 'https://www.eporner.com/embed/cIG0retUIzC/', quality: '1080p HD' }
        ];
    }

    const globalSeenShortsIds = new Set();

    async function fetchContent(reset = false) {
        if (state.view === 'favorites') {
            renderFavorites();
            return;
        }

        const isTikTokMode = document.body.dataset.theme === 'tiktok' || state.view === 'shorts';

        const fetchKey = `${state.source}_${state.category}_${state.query}_${state.page}_${reset}`;
        const now = Date.now();
        if (state.loading && reset && now - lastFetchCallInfo.time < 400 && lastFetchCallInfo.key === fetchKey) {
            return;
        }
        lastFetchCallInfo = { time: now, key: fetchKey };

        const currentSession = ++state.searchSessionId;
        state.loading = true;

        const grid = elements.grid || document.getElementById('mediaGrid');
        const countBadge = elements.itemCount || document.getElementById('itemCount');
        const loadMoreBtn = elements.loadMoreBtn || document.getElementById('btnLoadMore');

        let hasClearedSkeletons = !reset;

        if (reset) {
            state.page = 1;
            state.items = [];
            globalSeenShortsIds.clear();
            // Try instant cache restoration first (0ms load without screen flash)
            if (!state.query && tryRestoreFeedCache()) {
                hasClearedSkeletons = true;
            } else {
                if (grid) grid.innerHTML = getSkeletonHTML(12);
                if (countBadge) countBadge.textContent = '(cargando...)';
            }
        }

        if (loadMoreBtn) {
            loadMoreBtn.innerHTML = '<span class="spinner"></span> Cargando más contenido...';
            loadMoreBtn.disabled = true;
            loadMoreBtn.style.display = 'flex';
        }

        const q = state.query;
        const cat = state.category;
        const src = state.source;
        const page = state.page;
        const filter = state.filter;

        function appendProgressiveItems(items) {
            if (state.searchSessionId !== currentSession) return;
            if (!items || items.length === 0) return;

            const targetGrid = elements.grid || document.getElementById('mediaGrid');
            if (!targetGrid) return;

            const existingIds = new Set(state.items.map(i => i.id));
            const uniqueItems = items.filter(i => {
                if (existingIds.has(i.id)) return false;
                if (isTikTokMode && (globalSeenShortsIds.has(i.id) || (i.raw_id && globalSeenShortsIds.has(i.raw_id)))) return false;
                return true;
            });
            if (uniqueItems.length === 0) return;

            if (isTikTokMode) {
                uniqueItems.forEach(i => {
                    if (i.id) globalSeenShortsIds.add(i.id);
                    if (i.raw_id) globalSeenShortsIds.add(i.raw_id);
                });
            }

            if (!hasClearedSkeletons) {
                targetGrid.innerHTML = '';
                hasClearedSkeletons = true;
            }

            state.items.push(...uniqueItems);
            renderCards(uniqueItems);
            saveFeedCache();

            const badge = elements.itemCount || document.getElementById('itemCount');
            if (badge) {
                badge.textContent = `(${state.items.length}+ videos)`;
            }
        }

        const providerTasks = [];

        // 1. Instant User Posts (Page 1)
        if (page === 1) {
            const userTask = fetch(`api.php?action=user_posts&q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`)
                .then(r => r.ok ? r.json() : null)
                .then(res => {
                    if (res && res.status === 'success' && res.data && res.data.length > 0) {
                        appendProgressiveItems(res.data);
                    }
                })
                .catch(() => {});
            providerTasks.push(userTask);
        }

        // 2. Intelligent Algorithmic TikTok Feed Engine (FYP Multi-Tier Stream)
        if (isTikTokMode || src === 'all' || src === 'redgifs' || state.view === 'shorts') {
            const rgTask = (async () => {
                if (isTikTokMode && !q && !cat) {
                    // --- MULTI-TIER PARALLEL ALGORITHM FETCHER ---
                    const topTags = AlgorithmEngine.getTopPreferredTags(2);
                    const discoveryTags = AlgorithmEngine.getDiscoveryTags(1);
                    
                    const queryList = [
                        { tag: topTags[0] || 'latina', page: page },
                        { tag: topTags[1] || 'amateur', page: page },
                        { tag: discoveryTags[0] || 'cosplay', page: Math.floor(Math.random() * 10) + 1 },
                        { tag: 'trending', page: Math.floor(Math.random() * 15) + 1 }
                    ];

                    const fetchPromises = queryList.map(item => 
                        fetchDirectRedGifs(item.tag, item.page).catch(() => [])
                    );

                    const results = await Promise.all(fetchPromises);
                    const rawCandidates = results.flat().filter(Boolean);

                    if (rawCandidates.length > 0) {
                        const rankedItems = AlgorithmEngine.scoreAndDiversifyFeed(rawCandidates);
                        appendProgressiveItems(rankedItems);
                        return;
                    }
                }

                // Query Native Kotlin OkHttp Engine first (0 CORS, 0 403 hotlink blocks)
                try {
                    const res = await fetch(`api.php?action=search&source=redgifs&q=${encodeURIComponent(q || 'trending')}&category=${encodeURIComponent(cat)}&page=${page}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.data && data.data.length > 0) {
                            const ranked = isTikTokMode ? AlgorithmEngine.scoreAndDiversifyFeed(data.data) : data.data;
                            appendProgressiveItems(ranked);
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('Native RedGifs search error, trying direct:', e);
                }

                // Fallback to direct RedGifs fetch
                const direct = await fetchDirectRedGifs(q || cat || 'trending', page);
                if (direct && direct.length > 0) {
                    const ranked = isTikTokMode ? AlgorithmEngine.scoreAndDiversifyFeed(direct) : direct;
                    appendProgressiveItems(ranked);
                }
            })().catch(() => {});
            providerTasks.push(rgTask);
        }

        // In TikTok mode, ONLY load vertical videos and creator shorts (Do not mix 16:9 tube videos)
        if (!isTikTokMode) {
            // 3. Pornhub API Stream (Standard Desktop & Tube Themes)
            if (src === 'all' || src === 'pornhub') {
                const phTask = fetch(`api.php?action=search&source=pornhub&q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}&page=${page}&filter=${filter}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && data.data && data.data.length > 0) {
                            appendProgressiveItems(data.data);
                        }
                    })
                    .catch(() => {});
                providerTasks.push(phTask);
            }

            // 4. RedTube API Stream (Standard Desktop & Tube Themes)
            if (src === 'all' || src === 'redtube') {
                const rtTask = fetch(`api.php?action=search&source=redtube&q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}&page=${page}&filter=${filter}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && data.data && data.data.length > 0) {
                            appendProgressiveItems(data.data);
                        }
                    })
                    .catch(() => {});
                providerTasks.push(rtTask);
            }

            // 5. XVideos Provider Stream
            if (src === 'all' || src === 'xvideos') {
                const xvTask = fetch(`api.php?action=search&source=xvideos&q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}&page=${page}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && data.data && data.data.length > 0) {
                            appendProgressiveItems(data.data);
                        }
                    })
                    .catch(() => {});
                providerTasks.push(xvTask);
            }

            // 6. XNXX Provider Stream
            if (src === 'all' || src === 'xnxx') {
                const xnTask = fetch(`api.php?action=search&source=xnxx&q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}&page=${page}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && data.data && data.data.length > 0) {
                            appendProgressiveItems(data.data);
                        }
                    })
                    .catch(() => {});
                providerTasks.push(xnTask);
            }

            // 7. Eporner Provider Stream
            if (src === 'all' || src === 'eporner') {
                const epTask = fetch(`api.php?action=search&source=eporner&q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}&page=${page}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && data.data && data.data.length > 0) {
                            appendProgressiveItems(data.data);
                        }
                    })
                    .catch(() => {});
                providerTasks.push(epTask);
            }

            // 8. Dynamic X Feed: Mix in Booru Hot Photos on Initial Page
            if (document.body.dataset.theme === 'twitter' && src === 'all' && page === 1) {
                const xPhotoTask = fetch(`api.php?action=photos&q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}&page=1`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && data.data && data.data.length > 0) {
                            appendProgressiveItems(data.data.slice(0, 6));
                        }
                    })
                    .catch(() => {});
                providerTasks.push(xPhotoTask);
            }
        }

        // 9. Dedicated Hot / Hentai Booru Photos Stream
        if (src === 'photos') {
            const photosTask = fetch(`api.php?action=photos&q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}&page=${page}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data && data.data && data.data.length > 0) {
                        const ranked = AlgorithmEngine.scoreAndDiversifyFeed(data.data, 'photos');
                        appendProgressiveItems(ranked);
                    }
                })
                .catch(() => {});
            providerTasks.push(photosTask);
        }

        await Promise.allSettled(providerTasks);

        if (state.searchSessionId !== currentSession) return;
        state.loading = false;

        const targetGrid = elements.grid || document.getElementById('mediaGrid');
        const btnLoad = elements.loadMoreBtn || document.getElementById('btnLoadMore');

        if (!hasClearedSkeletons && targetGrid) {
            const fallbackCurated = getCuratedLocalFeed(state.source);
            if (fallbackCurated && fallbackCurated.length > 0) {
                appendProgressiveItems(fallbackCurated);
            } else {
                targetGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                        <h3 style="font-size: 20px; margin-bottom: 8px;">No se encontraron resultados</h3>
                        <p style="color: var(--text-dim);">Prueba con otra categoría o búsqueda.</p>
                    </div>
                `;
            }
            if (btnLoad) btnLoad.style.display = 'none';
        } else if (btnLoad) {
            btnLoad.innerHTML = '⚡ Cargar más videos';
            btnLoad.disabled = false;
            btnLoad.style.display = 'flex';
        }
    }



    // Fast In-Memory and CacheStorage Preloader
    const preloadedThumbs = new Set();
    function preloadThumbnails(items) {
        if (!items || !items.length) return;
        items.forEach(item => {
            const rawList = [item.thumb, ...(item.thumbs || [])];
            const urls = rawList.map(u => (typeof u === 'string' ? u : (u && u.src ? u.src : ''))).filter(Boolean);
            urls.forEach(url => {
                if (typeof url === 'string' && !preloadedThumbs.has(url) && !url.startsWith('data:')) {
                    preloadedThumbs.add(url);
                    try {
                        const img = new Image();
                        img.referrerPolicy = 'no-referrer';
                        img.src = url;
                    } catch(e) {}
                }
            });
        });
    }

    const CREATOR_AVATARS = [
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%2338bdf8'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%2338bdf8'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%23f43f5e'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%23f43f5e'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%23a855f7'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%23a855f7'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%2310b981'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%2310b981'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%23eab308'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%23eab308'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%23ec4899'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%23ec4899'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%236366f1'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%236366f1'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%2314b8a6'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%2314b8a6'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%23f97316'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%23f97316'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%2318181b'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%2306b6d4'/%3E%3Cpath d='M16 68c0-13.25 10.75-24 24-24s24 10.75 24 24' fill='%2306b6d4'/%3E%3C/svg%3E"
    ];

    function getCreatorAvatar(author, rawId) {
        if (!author) return CREATOR_AVATARS[0];
        const hash = Math.abs(String(author + (rawId || '')).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
        return CREATOR_AVATARS[hash % CREATOR_AVATARS.length];
    }

    const FALLBACK_THUMB = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%230e0e12'/%3E%3Ccircle cx='320' cy='170' r='42' fill='%231a1a22' stroke='%232a2a36' stroke-width='2'/%3E%3Cpolygon points='314,154 334,170 314,186' fill='%23ff9000'/%3E%3Ctext x='320' y='245' font-family='-apple-system,BlinkMacSystemFont,sans-serif' font-size='22' font-weight='900' fill='%23ff9000' text-anchor='middle'%3EALL18%3C/text%3E%3Ctext x='320' y='270' font-family='-apple-system,BlinkMacSystemFont,sans-serif' font-size='13' font-weight='600' fill='%23666677' text-anchor='middle'%3EVideo Exclusivo%3C/text%3E%3C/svg%3E";
    window.FALLBACK_THUMB = FALLBACK_THUMB;

    // =========================================================
    // CONTINUAR VIENDO / WATCH HISTORY & RESUME ENGINE (v1.3.1)
    // =========================================================
    function getWatchHistory() {
        try {
            const raw = localStorage.getItem('all18_watch_history');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }
    window.getWatchHistory = getWatchHistory;

    function getWatchHistoryProgress(id) {
        if (!id) return 0;
        try {
            const history = getWatchHistory();
            const found = history.find(h => h.id === id);
            return found ? (found.progressPercent || 0) : 0;
        } catch (e) {
            return 0;
        }
    }
    window.getWatchHistoryProgress = getWatchHistoryProgress;

    function parseDurationToSeconds(durStr) {
        if (!durStr || typeof durStr !== 'string') return 600;
        const parts = durStr.split(':').map(p => parseInt(p, 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return (parts[0] * 60) + parts[1];
        }
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        }
        return 600;
    }

    function formatSecondsToTime(sec) {
        const s = Math.floor(sec || 0);
        const mins = Math.floor(s / 60);
        const remainingSecs = s % 60;
        return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    }

    function saveWatchHistory(item, currentTime, duration) {
        if (!item || !item.id) return;
        try {
            const history = getWatchHistory();
            const durationSec = (duration && !isNaN(duration) && duration > 0) ? duration : (item.duration ? parseDurationToSeconds(item.duration) : 600);
            const percent = durationSec > 0 ? Math.min(100, Math.round((currentTime / durationSec) * 100)) : 0;
            
            const existingIdx = history.findIndex(h => h.id === item.id);
            const entry = {
                id: item.id,
                raw_id: item.raw_id || '',
                title: item.title || 'Video All18',
                thumb: item.thumb || '',
                author: item.author || '',
                duration: item.duration || '',
                source: item.source || '',
                media_url: item.media_url || '',
                embed_url: item.embed_url || '',
                currentTime: Math.floor(currentTime || 0),
                durationSec: Math.floor(durationSec),
                progressPercent: percent,
                updatedAt: Date.now()
            };

            if (existingIdx >= 0) {
                history.splice(existingIdx, 1);
            }
            history.unshift(entry);
            if (history.length > 60) history.pop();
            localStorage.setItem('all18_watch_history', JSON.stringify(history));
        } catch (e) {}
    }
    window.saveWatchHistory = saveWatchHistory;

    function createVideoCard(item, index = 10) {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.dataset.id = item.id;

        const isFav = state.favorites.some(f => f.id === item.id);
        const isUserPost = !!item.is_user_post;
        const isPhoto = item.type === 'photo';
        const savedProgress = getWatchHistoryProgress(item.id);
        const initialThumb = item.thumb || FALLBACK_THUMB;
        const mediaVideoUrl = item.preview_url || item.preview_video || item.media_url || item.hd_url || item.sd_url || (isUserPost && item.video_url ? item.video_url : '') || (item.source === 'RedGifs' && item.raw_id ? `https://media.redgifs.com/${item.raw_id}.mp4` : '');

        // Dynamic realistic stats
        const seed = Math.abs(String(item.id || '123').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
        const pseudoMin = (seed % 55) + 3;
        const timeAgo = pseudoMin > 45 ? Math.floor(pseudoMin / 10) + 'h' : pseudoMin + 'min';
        const commentsCount = (seed % 650) + 24;
        const repostsCount = (seed % 880) + 50;
        const rawLikes = (seed * 123) % 95000 + 1200;
        const formattedLikes = rawLikes > 999 ? (rawLikes / 1000).toFixed(1) + ' mil' : rawLikes;
        const authorHandle = (item.author || 'creador').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'all18creator';
        const authorAvatar = item.author_avatar || getCreatorAvatar(item.author, item.id);

        const currentTheme = document.body.dataset.theme || 
            (document.body.classList.contains('tiktok-standalone-body') ? 'tiktok' : 
            (document.body.classList.contains('twitter-standalone-body') ? 'twitter' : 
            (document.body.classList.contains('instagram-standalone-body') ? 'instagram' : 'pornhub')));

        // -------------------------------------------------------------
        // 1. THEME: TWITTER / 𝕏 TIMELINE
        // -------------------------------------------------------------
        if (currentTheme === 'twitter') {
            card.innerHTML = `
                <div class="x-avatar-col">
                    <img class="x-avatar-img" src="${authorAvatar}" alt="${escapeHTML(item.author || 'Creador')}" loading="lazy" />
                </div>
                <div class="card-main-body">
                    <div class="x-post-header">
                        <div class="x-author-meta">
                            <span class="x-author-name">${escapeHTML(item.author || 'Creador')}</span>
                            <svg class="x-badge-icon" viewBox="0 0 24 24" width="16" height="16"><path fill="#1d9bf0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.75 4.5l-4-4 1.41-1.41L10.5 13.67l6.59-6.59 1.41 1.41-8 8z"/></svg>
                            <span class="x-author-handle">@${authorHandle}</span>
                            <span class="x-post-dot">&middot;</span>
                            <span class="x-post-time">${timeAgo}</span>
                        </div>
                        <div class="x-header-right-actions" style="display: flex; align-items: center; gap: 4px;">
                            <button class="x-card-cinema-btn" type="button" title="Ver en Modo Cine / Watch" onclick="event.stopPropagation(); window.openWatchCinemaItem && window.openWatchCinemaItem('${item.id}');">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 6h16v12H4z M10 9v6l5-3z"/></svg>
                            </button>
                            <span class="x-more-btn" title="Más opciones">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
                            </span>
                        </div>
                    </div>
                    <p class="x-post-text">
                        ${escapeHTML(item.title || '').replace(/(#[a-zA-Z0-9_]+)/g, '<span class="x-hashtag">$1</span>').replace(/(@[a-zA-Z0-9_]+)/g, '<span class="x-mention">$1</span>')}
                    </p>
                    <div class="thumb-container${isPhoto ? ' is-photo-card' : ''}">
                        <img class="thumb-img" src="${initialThumb}" alt="${escapeHTML(item.title || 'Video')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.classList.add('loaded')" onerror="this.onerror=null; this.src=window.FALLBACK_THUMB||''; this.classList.add('loaded');"/>
                        ${!isPhoto && mediaVideoUrl ? `<video class="feed-video-player" referrerpolicy="no-referrer" loop playsinline muted preload="none" data-src="${mediaVideoUrl}" poster="${initialThumb}"></video>` : ''}
                        ${!isPhoto ? `<span class="duration-badge">${item.duration || '0:34'}</span>` : ''}
                        ${!isPhoto && savedProgress > 0 ? `<div class="card-watch-progress"><div class="card-watch-progress-fill" style="width:${savedProgress}%;"></div></div>` : ''}
                        ${!isPhoto ? `
                        <div class="x-center-play">
                            <svg viewBox="0 0 24 24" width="32" height="32" fill="#ffffff"><path d="M8 5v14l11-7z"/></svg>
                        </div>` : ''}
                    </div>
                    <div class="x-action-bar">
                        <div class="x-action-item x-action-reply" title="Comentarios">
                            <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-1.602.89 1.002 3.43c.18.61-.41 1.15-.99.91l-4.75-2.02-1.96.18c-.66.06-1.32.09-1.98.09-4.421 0-8.004-3.58-8.004-8.02zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.744 6.02 6.085 6.02.69 0 1.38-.03 2.08-.1l.6-.05 3.39 1.44-.69-2.36.27-.15c2.15-1.19 3.49-3.46 3.49-5.93 0-3.38-2.75-6.13-6.13H9.756z"/></svg>
                            <span>${commentsCount}</span>
                        </div>
                        <div class="x-action-item x-action-repost" title="Repostear">
                            <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.9 2 2 2H16v2H7.5c-2.21 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 20.12l-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.9-2-2-2H8V4h8.5c2.21 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14z"/></svg>
                            <span>${repostsCount}</span>
                        </div>
                        <div class="x-action-item x-action-like ${isFav ? 'active' : ''}" title="Me gusta" data-fav-id="${item.id}">
                            <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.807 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-2.427.12-4.504 2.21-4.298 5.05.318 4.39 6.816 9.45 8.994 10.95.54.37 1.27.37 1.81 0 2.18-1.5 8.68-6.56 8.99-10.95.21-2.84-1.87-4.93-4.3-5.05zm-4.697 14.5c-2.42-1.72-8.08-6.17-8.3-9.52-.16-2.22 1.44-3.79 3.32-3.88.94-.05 2.13.43 3.08 1.71l1.9 2.57 1.9-2.57c.95-1.28 2.14-1.76 3.08-1.71 1.88.09 3.48 1.66 3.32 3.88-.22 3.35-5.88 7.8-8.3 9.52z"/></svg>
                            <span class="x-like-count">${formattedLikes}</span>
                        </div>
                        <div class="x-action-item x-action-views" title="Vistas">
                            <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"/></svg>
                            <span>${item.views || '164 mil'}</span>
                        </div>
                        <div class="x-action-item x-action-bookmark ${isFav ? 'active' : ''}" title="Guardar">
                            <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M18 3H6c-1.1 0-2 .9-2 2v16l8-4 8 4V5c0-1.1-.9-2-2-2zm0 15.55l-6-3-6 3V5h12v13.55z"/></svg>
                        </div>
                        <div class="x-action-item x-action-share" title="Compartir">
                            <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41L7.71 9.71 6.3 8.29 12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21.01 3 19.9 3 18.51V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5V15h2.02z"/></svg>
                        </div>
                    </div>
                </div>
            `;
        }

        // -------------------------------------------------------------
        // 2. THEME: INSTAGRAM
        // -------------------------------------------------------------
        else if (currentTheme === 'instagram') {
            card.innerHTML = `
                <div class="ig-post-header">
                    <div class="ig-post-header-left">
                        <div class="ig-post-avatar-ring">
                            <img class="ig-post-avatar-img" src="${authorAvatar}" alt="${escapeHTML(item.author || 'Creador')}" loading="lazy" />
                        </div>
                        <div class="ig-post-meta">
                            <div class="ig-post-author-row">
                                <span>${escapeHTML(item.author || 'Creador')}</span>
                                <svg class="ig-verified-badge" viewBox="0 0 24 24" width="13" height="13"><path fill="#0095f6" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                            </div>
                            <div class="ig-post-music-row">
                                <span>♫ ${escapeHTML(item.author || 'Audio original')} · Audio original</span>
                            </div>
                        </div>
                    </div>
                    <button class="ig-post-more-btn" type="button" title="Opciones" onclick="event.stopPropagation()">···</button>
                </div>
                <div class="thumb-container">
                    <img class="thumb-img" src="${initialThumb}" alt="${escapeHTML(item.title || 'Video')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.classList.add('loaded')" onerror="this.onerror=null; this.src=window.FALLBACK_THUMB||''; this.classList.add('loaded');"/>
                    ${mediaVideoUrl ? `<video class="feed-video-player" referrerpolicy="no-referrer" loop playsinline muted preload="none" data-src="${mediaVideoUrl}" poster="${initialThumb}"></video>` : ''}
                    ${savedProgress > 0 ? `<div class="card-watch-progress"><div class="card-watch-progress-fill" style="width:${savedProgress}%;"></div></div>` : ''}
                    <button class="ig-media-tagged-btn" type="button" title="Etiquetados" onclick="event.stopPropagation()">👤</button>
                    <button class="ig-media-mute-btn" type="button" title="Silenciar / Activar sonido" onclick="event.stopPropagation()">🔇</button>
                </div>
                <div class="ig-action-bar">
                    <div class="ig-action-left">
                        <button class="ig-action-item ig-action-like ${isFav ? 'active' : ''}" type="button" title="Me gusta" data-fav-id="${item.id}">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="${isFav ? '#ff3040' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <span>${formattedLikes}</span>
                        </button>
                        <button class="ig-action-item ig-action-comment" type="button" title="Comentarios">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                            <span>${commentsCount}</span>
                        </button>
                        <button class="ig-action-item ig-action-repost" type="button" title="Repostear">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="17 1 21 5 17 9"></polyline>
                                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                                <polyline points="7 23 3 19 7 15"></polyline>
                                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                            </svg>
                        </button>
                        <button class="ig-action-item ig-action-dm" type="button" title="Compartir">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                            <span>${item.views || '10.5 mil'}</span>
                        </button>
                    </div>
                    <button class="ig-action-item ig-action-save ${isFav ? 'active' : ''}" type="button" title="Guardar">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="${isFav ? '#ffffff' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>
                </div>
                <div class="ig-post-details">
                    <div class="ig-likes-proof">Les gusta a <strong>${escapeHTML(item.author || 'usuario')}</strong> y <strong>otros</strong></div>
                    <p class="ig-post-caption">
                        <strong>${escapeHTML(item.author || 'creador')}</strong> ${escapeHTML(item.title || '')}
                    </p>
                </div>
            `;
        }

        // -------------------------------------------------------------
        // 3. THEME: TIKTOK
        // -------------------------------------------------------------
        else if (currentTheme === 'tiktok') {
            card.innerHTML = `
                <div class="thumb-container">
                    <img class="thumb-img" src="${initialThumb}" alt="${escapeHTML(item.title || 'Video')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.classList.add('loaded')" onerror="this.onerror=null; this.src=window.FALLBACK_THUMB||''; this.classList.add('loaded');"/>
                    ${mediaVideoUrl ? `<video class="feed-video-player" referrerpolicy="no-referrer" loop playsinline muted preload="none" data-src="${mediaVideoUrl}" poster="${initialThumb}"></video>` : ''}
                    <div class="tiktok-center-play">
                        <svg viewBox="0 0 24 24" width="64" height="64" fill="rgba(255,255,255,0.85)"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                </div>
                <div class="tiktok-overlay">
                    <div class="tiktok-left-info">
                        <div class="tiktok-author">@${authorHandle}</div>
                        <div class="tiktok-title">${escapeHTML(item.title || '')} <span class="tt-hashtag">#fyp</span> <span class="tt-hashtag">#viral</span></div>
                        <div class="tiktok-music">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="#ffffff"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                            <div class="tiktok-music-marquee"><span>♫ Sonido original - @${authorHandle}</span></div>
                        </div>
                    </div>
                    <div class="tiktok-right-actions">
                        <div class="tiktok-avatar-wrap">
                            <div class="tiktok-avatar-badge">
                                <img class="tiktok-avatar-img" src="${authorAvatar}" alt="avatar" />
                            </div>
                            <div class="tiktok-follow-plus">+</div>
                        </div>
                        <button class="tiktok-action-item tiktok-btn-like ${isFav ? 'active' : ''}" type="button" title="Me gusta" style="background: transparent !important; border: none !important; -webkit-appearance: none !important;">
                            <svg viewBox="0 0 24 24" width="34" height="34" fill="${isFav ? '#fe2c55' : '#ffffff'}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            <span class="tiktok-action-count">${formattedLikes}</span>
                        </button>
                        <button class="tiktok-action-item tiktok-btn-sound" type="button" title="Sonido" onclick="window.toggleTikTokSound(event, this)" style="background: transparent !important; border: none !important; -webkit-appearance: none !important;">
                            <span class="tiktok-sound-icon" style="font-size: 26px; line-height: 1;">${window.isTikTokMuted === false ? '🔊' : '🔇'}</span>
                            <span class="tiktok-action-count">${window.isTikTokMuted === false ? 'Sonido' : 'Silencio'}</span>
                        </button>
                        <button class="tiktok-action-item card-fav-btn ${isFav ? 'active' : ''}" type="button" title="Favoritos" data-id="${item.id}" style="background: transparent !important; border: none !important; -webkit-appearance: none !important;">
                            <svg viewBox="0 0 24 24" width="34" height="34" fill="${isFav ? '#face15' : '#ffffff'}"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                            <span class="tiktok-action-count">${repostsCount}</span>
                        </button>
                        <button class="tiktok-action-item" type="button" title="Compartir" onclick="if(navigator.clipboard){navigator.clipboard.writeText(window.location.href);window.showToast && window.showToast('🔗 Enlace copiado');}" style="background: transparent !important; border: none !important; -webkit-appearance: none !important;">
                            <svg viewBox="0 0 24 24" width="34" height="34" fill="#ffffff"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                            <span class="tiktok-action-count">Compartir</span>
                        </button>
                        <div class="tiktok-disc-spin">
                            <div class="tiktok-vinyl">
                                <img src="${authorAvatar}" alt="disc" />
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // -------------------------------------------------------------
        // 4. THEME: ALLTUBE (PORNHUB) & DEFAULT
        // -------------------------------------------------------------
        else {
            card.innerHTML = `
                <div class="thumb-container${isPhoto ? ' is-photo-card' : ''}">
                    <img class="thumb-img" src="${initialThumb}" alt="${escapeHTML(item.title || 'Video')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.classList.add('loaded')" onerror="this.onerror=null; this.src=window.FALLBACK_THUMB||''; this.classList.add('loaded');"/>
                    ${!isPhoto && mediaVideoUrl ? `<video class="feed-video-player" referrerpolicy="no-referrer" loop playsinline muted preload="none" data-src="${mediaVideoUrl}" poster="${initialThumb}"></video>` : ''}
                    ${!isPhoto ? `<span class="duration-badge">${item.duration || '18:50'}</span>` : ''}
                    ${!isPhoto ? `<span class="source-badge-pill ${item.source || 'Pornhub'}">${item.source || 'Pornhub'}</span>` : ''}
                    ${!isPhoto && savedProgress > 0 ? `<div class="card-watch-progress"><div class="card-watch-progress-fill" style="width:${savedProgress}%;"></div></div>` : ''}
                    <button class="card-fav-btn ${isFav ? 'active' : ''}" title="Guardar en favoritos" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </button>
                </div>
                <div class="video-info">
                    <div class="ph-meta-row">
                        <div class="ph-author-wrap">
                            <span>${escapeHTML(item.author || 'Creador')}</span>
                            <svg class="ph-verified-badge" viewBox="0 0 24 24" width="13" height="13"><path fill="#00aaff" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        </div>
                        <div class="ph-views-wrap">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                            <span>${item.views || "288K"}</span>
                        </div>
                    </div>
                    <div class="ph-title-row">
                        <h3 class="video-title" title="${escapeHTML(item.title || '')}">${escapeHTML(item.title || '')}</h3>
                        <button class="ph-more-btn" type="button" title="Opciones" onclick="event.stopPropagation()">⋮</button>
                    </div>
                </div>
            `;
        }

        const videoEl = card.querySelector('.feed-video-player');

        // Video Error Recovery (Fallback to HD or isolated Embed Iframe)
        if (videoEl) {
            videoEl.addEventListener('error', () => {
                console.warn('Video failed to play, switching to fallback:', item.id);
                if (item.hd_url && videoEl.src !== item.hd_url) {
                    videoEl.src = item.hd_url;
                    videoEl.play().catch(() => {});
                } else if (item.sd_url && videoEl.src !== item.sd_url) {
                    videoEl.src = item.sd_url;
                    videoEl.play().catch(() => {});
                } else if (item.source !== 'RedGifs' && item.embed_url) {
                    const thumbContainer = card.querySelector('.thumb-container');
                    if (thumbContainer) {
                        thumbContainer.innerHTML = `
                            <iframe src="${item.embed_url}" frameborder="0" width="100%" height="100%" scrolling="no" allow="autoplay; fullscreen" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;background:#000;z-index:2;"></iframe>
                        `;
                        card.classList.add('video-playing');
                    }
                }
            });
        }

        // Telemetry & Engagement tracking for Recommendation Algorithm
        let cardPlayStartTime = 0;
        let cardLoopCount = 0;

        if (videoEl) {
            videoEl.addEventListener('play', () => {
                cardPlayStartTime = Date.now();
            });

            videoEl.addEventListener('timeupdate', () => {
                if (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.3) {
                    cardLoopCount++;
                    if (cardLoopCount === 1) {
                        AlgorithmEngine.recordEngagement(item, 'loop');
                    }
                }
            });

            videoEl.addEventListener('pause', () => {
                if (cardPlayStartTime > 0) {
                    const watchedSec = (Date.now() - cardPlayStartTime) / 1000;
                    if (watchedSec > 5) {
                        AlgorithmEngine.recordEngagement(item, 'watch_good');
                    } else if (watchedSec < 1.5 && cardLoopCount === 0) {
                        AlgorithmEngine.recordEngagement(item, 'skip_fast');
                    }
                    cardPlayStartTime = 0;
                }
            });
        }

        // Like Button Interaction (TikTok)
        const ttLikeBtn = card.querySelector('.tiktok-btn-like');
        if (ttLikeBtn) {
            ttLikeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                const isNowFav = state.favorites.some(f => f.id === item.id);
                ttLikeBtn.classList.toggle('active', isNowFav);
                if (isNowFav) {
                    AlgorithmEngine.recordEngagement(item, 'like');
                    showToast('❤️ Añadido a Me Gusta');
                }
            });
        }

        // Follow Button Interaction (TikTok)
        const ttFollowBtn = card.querySelector('.tiktok-follow-plus');
        if (ttFollowBtn) {
            ttFollowBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                ttFollowBtn.style.display = 'none';
                AlgorithmEngine.recordEngagement(item, 'follow');
                showToast(`➕ Siguiendo a ${item.author || 'creador'}`);
            });
        }

        // Instagram Like Interaction
        const igLikeBtn = card.querySelector('.ig-action-like');
        if (igLikeBtn) {
            igLikeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                const isNowFav = state.favorites.some(f => f.id === item.id);
                igLikeBtn.classList.toggle('active', isNowFav);
                const svgEl = igLikeBtn.querySelector('svg');
                if (svgEl) svgEl.setAttribute('fill', isNowFav ? '#ff3040' : 'none');
                if (isNowFav) AlgorithmEngine.recordEngagement(item, 'like');
            });
        }

        // Instagram Save Interaction
        const igSaveBtn = card.querySelector('.ig-action-save');
        if (igSaveBtn) {
            igSaveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                const isNowFav = state.favorites.some(f => f.id === item.id);
                igSaveBtn.classList.toggle('active', isNowFav);
                const svgEl = igSaveBtn.querySelector('svg');
                if (svgEl) svgEl.setAttribute('fill', isNowFav ? '#ffffff' : 'none');
                showToast(isNowFav ? '🔖 Guardado en tu colección' : 'Elemento eliminado de guardados');
            });
        }

        // Instagram DM Share
        const igDmBtn = card.querySelector('.ig-action-dm');
        if (igDmBtn) {
            igDmBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                    showToast('🔗 Enlace de publicación copiado');
                }
            });
        }

        // Instagram Mute Toggle
        const igMuteBtn = card.querySelector('.ig-media-mute-btn');
        if (igMuteBtn && videoEl) {
            igMuteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                videoEl.muted = !videoEl.muted;
                igMuteBtn.innerText = videoEl.muted ? '🔇' : '🔊';
            });
        }

        // X Bookmark Interaction
        const xBookmarkBtn = card.querySelector('.x-action-bookmark');
        if (xBookmarkBtn) {
            xBookmarkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                const isNowFav = state.favorites.some(f => f.id === item.id);
                xBookmarkBtn.classList.toggle('active', isNowFav);
                showToast(isNowFav ? '🔖 Guardado en tus elementos' : 'Elemento eliminado');
            });
        }

        // X Repost Interaction
        const xRepostBtn = card.querySelector('.x-action-repost');
        if (xRepostBtn) {
            xRepostBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isNowRepost = !xRepostBtn.classList.contains('active');
                xRepostBtn.classList.toggle('active', isNowRepost);
                showToast(isNowRepost ? '🔁 Reposteado en tu perfil' : 'Repost eliminado');
            });
        }

        // X Like Interaction
        const xLikeBtn = card.querySelector('.x-action-like');
        if (xLikeBtn) {
            xLikeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                const isNowFav = state.favorites.some(f => f.id === item.id);
                xLikeBtn.classList.toggle('active', isNowFav);
                const countSpan = xLikeBtn.querySelector('.x-like-count');
                if (countSpan) {
                    const current = parseInt(countSpan.textContent, 10) || rawLikes;
                    countSpan.textContent = isNowFav ? current + 1 : Math.max(0, current - 1);
                }
            });
        }

        // X Share Interaction
        const xShareBtn = card.querySelector('.x-action-share');
        if (xShareBtn) {
            xShareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.shareVideoItem(item);
            });
        }

        // Click Favorite (standard button)
        const favBtn = card.querySelector('.card-fav-btn');
        if (favBtn) {
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                AlgorithmEngine.recordEngagement(item, 'favorite');
            });
        }

        // Click Card -> Toggle Play/Pause or Open Player
        card.addEventListener('click', (e) => {
            if (e.target.closest('.x-action-item') || e.target.closest('.card-fav-btn') || e.target.closest('.x-more-btn') || e.target.closest('.x-card-cinema-btn') || e.target.closest('.tiktok-action-item') || e.target.closest('.ig-action-item') || e.target.closest('.ig-post-more-btn') || e.target.closest('.ig-media-mute-btn')) {
                return;
            }

            const isTikTok = currentTheme === 'tiktok';

            if (isTikTok && videoEl) {
                if (videoEl.paused) {
                    if (!videoEl.src && videoEl.dataset.src) videoEl.src = videoEl.dataset.src;
                    videoEl.play().then(() => {
                        card.classList.add('video-playing');
                    }).catch(() => {});
                } else {
                    videoEl.pause();
                    card.classList.remove('video-playing');
                }
                return;
            }

            // In Photo Card: Open High-Res Lightbox (Never send to video player)
            if (isPhoto) {
                if (typeof window.openXMediaModal === 'function') {
                    window.openXMediaModal(item);
                    return;
                }
                if (typeof window.openIgMediaModal === 'function') {
                    window.openIgMediaModal(item);
                    return;
                }
                const photoSrc = item.image_url || item.thumb;
                if (photoSrc) {
                    window.open(photoSrc, '_blank');
                    AlgorithmEngine.recordEngagement(item, 'photo_click');
                }
                return;
            }

            // In X Theme: Open 1:1 Fullscreen Media Viewer Lightbox (Never redirect to AllTube/Pornhub!)
            if (currentTheme === 'twitter') {
                if (typeof window.openXMediaModal === 'function') {
                    window.openXMediaModal(item);
                }
                return;
            }

            // In Instagram Theme: Open 1:1 Fullscreen Reels / Media Viewer (Never redirect to AllTube/Pornhub!)
            if (currentTheme === 'instagram') {
                if (typeof window.openIgMediaModal === 'function') {
                    window.openIgMediaModal(item);
                }
                return;
            }

            // Other themes or standard tube: open watch view
            if (!window.location.pathname.includes('watch.html') && !window.location.pathname.includes('watch.php') && !document.body.classList.contains('watch-page-body')) {
                try { try { localStorage.setItem('all18_current_watch', JSON.stringify(item)); } catch(e){}; sessionStorage.setItem('all18_current_watch', JSON.stringify(item)); } catch (err) {}
                const pageFrom = window.location.pathname.includes('hub.html') ? 'hub' : (window.location.pathname.includes('tiktok.html') ? 'tiktok' : (window.location.pathname.includes('twitter.html') ? 'twitter' : 'index'));
                window.location.href = `watch.html?v=${encodeURIComponent(item.id)}&embed=${encodeURIComponent(item.embed_url || '')}&title=${encodeURIComponent(item.title || '')}&source=${encodeURIComponent(item.source || '')}&from=${pageFrom}`;
            } else {
                openWatchView(item);
            }
        });

        // Desktop Hover Preview for Video Thumbnails
        if (videoEl) {
            const thumbContainer = card.querySelector('.thumb-container');
            if (thumbContainer) {
                thumbContainer.addEventListener('mouseenter', () => {
                    if (videoEl.dataset.src) {
                        if (!videoEl.src) videoEl.src = videoEl.dataset.src;
                        videoEl.muted = true;
                        videoEl.play().then(() => {
                            card.classList.add('video-playing');
                        }).catch(() => {});
                    }
                });
                thumbContainer.addEventListener('mouseleave', () => {
                    if (!document.body.classList.contains('tiktok-standalone-body') && document.body.dataset.theme !== 'tiktok') {
                        videoEl.pause();
                        videoEl.currentTime = 0;
                        card.classList.remove('video-playing');
                    }
                });
            }
        }

        // Setup IntersectionObserver for auto-playing in viewport without decoder exhaustion
        if (videoEl && window.IntersectionObserver) {
            if (!window.feedVideoObserver) {
                window.feedVideoObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const targetCard = entry.target;
                        const v = targetCard.querySelector('.feed-video-player');
                        if (!v) return;

                        const isTT = document.body.dataset.theme === 'tiktok' || document.body.classList.contains('tiktok-standalone-body');

                        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                            if (!v.src && v.dataset.src) {
                                v.src = v.dataset.src;
                            }
                            v.muted = window.isTikTokMuted !== false;
                            v.defaultMuted = window.isTikTokMuted !== false;
                            v.play().then(() => {
                                targetCard.classList.add('video-playing');
                            }).catch(() => {});

                            // Preload next card video
                            const nextCard = targetCard.nextElementSibling;
                            if (nextCard) {
                                const nextV = nextCard.querySelector('.feed-video-player');
                                if (nextV && !nextV.src && nextV.dataset.src) {
                                    nextV.src = nextV.dataset.src;
                                    nextV.preload = 'metadata';
                                }
                            }
                        } else {
                            v.pause();
                            targetCard.classList.remove('video-playing');
                            // Release decoder on mobile when not in TikTok mode
                            if (!isTT && v.src) {
                                v.removeAttribute('src');
                                v.load();
                            }
                        }
                    });
                }, { threshold: [0.1, 0.5, 0.8] });
            }
            window.feedVideoObserver.observe(card);
        }

        return card;
    }
    function renderCards(items, prepend = false) {
        const grid = elements.grid || document.getElementById('mediaGrid');
        if (!grid) return;

        preloadThumbnails(items);

        const isTT = document.body.dataset.theme === 'tiktok' || document.body.classList.contains('tiktok-standalone-body');
        const itemsToRender = items;
        
        itemsToRender.forEach((item, index) => {
            const card = createVideoCard(item, index);

            // Add animated swipe hint to the very first card on TikTok
            if (isTT && index === 0 && !document.getElementById('tiktokSwipeHint')) {
                const hint = document.createElement('div');
                hint.className = 'tiktok-swipe-hint';
                hint.id = 'tiktokSwipeHint';
                hint.innerHTML = `
                    <div class="swipe-hint-icon">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="#fe2c55">
                            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                        </svg>
                    </div>
                    <span class="swipe-hint-text">Desliza hacia arriba para ver videos 👆</span>
                `;
                card.appendChild(hint);

                const dismissHint = (e) => {
                    const gridEl = document.getElementById('mediaGrid');
                    if (e && e.type === 'scroll' && gridEl && gridEl.scrollTop < 25) {
                        return;
                    }
                    hint.classList.add('fade-out');
                    setTimeout(() => hint.remove(), 500);
                    window.removeEventListener('touchstart', dismissHint);
                    window.removeEventListener('wheel', dismissHint);
                    if (gridEl) gridEl.removeEventListener('scroll', dismissHint);
                };

                // Dismiss only on actual user scroll or touch
                const gridEl = document.getElementById('mediaGrid');
                if (gridEl) {
                    gridEl.addEventListener('scroll', dismissHint, { passive: true });
                    gridEl.addEventListener('touchstart', dismissHint, { once: true, passive: true });
                    gridEl.addEventListener('wheel', dismissHint, { once: true, passive: true });
                }
            }

            if (prepend && grid.firstChild) {
                grid.insertBefore(card, grid.firstChild);
            } else {
                grid.appendChild(card);
            }
        });

        // Instant autoplay on TikTok initial load
        if (isTT) {
            setTimeout(() => {
                const firstCard = grid.querySelector('.video-card');
                if (firstCard && !grid.querySelector('.video-card.video-playing')) {
                    const firstVid = firstCard.querySelector('.feed-video-player');
                    if (firstVid) {
                        if (!firstVid.src && firstVid.dataset.src) firstVid.src = firstVid.dataset.src;
                        firstVid.muted = window.isTikTokMuted !== false;
                        firstVid.defaultMuted = window.isTikTokMuted !== false;
                        firstVid.play().then(() => {
                            firstCard.classList.add('video-playing');
                        }).catch(() => {});
                    }
                    const secCard = firstCard.nextElementSibling;
                    if (secCard) {
                        const secVid = secCard.querySelector('.feed-video-player');
                        if (secVid && !secVid.src && secVid.dataset.src) {
                            secVid.src = secVid.dataset.src;
                            secVid.preload = 'metadata';
                        }
                    }
                }
            }, 80);
        }
    }

    function openWatchView(item, pushHistory = true) {
        state.activeModalItem = item;
        try { try { localStorage.setItem('all18_current_watch', JSON.stringify(item)); } catch(e){}; sessionStorage.setItem('all18_current_watch', JSON.stringify(item)); } catch (e) {}
        const catalogView = document.getElementById('catalogView');
        const watchView = document.getElementById('watchView');
        
        // If watchView is missing (e.g. on index.html standalone), redirect to watch.html
        if (!watchView) {
            const pageFrom = window.location.pathname.includes('hub.html') ? 'hub' : (window.location.pathname.includes('tiktok.html') ? 'tiktok' : (window.location.pathname.includes('twitter.html') ? 'twitter' : 'index'));
            window.location.href = `watch.html?v=${encodeURIComponent(item.id)}&embed=${encodeURIComponent(item.embed_url || '')}&title=${encodeURIComponent(item.title || '')}&source=${encodeURIComponent(item.source || '')}&from=${pageFrom}`;
            return;
        }

        // Populate Player details
        const titleEl = document.getElementById('watchVideoTitle');
        const authorEl = document.getElementById('watchCreatorName');
        const sourceEl = document.getElementById('watchCreatorSource');
        const avatarEl = document.getElementById('watchCreatorAvatar');
        const viewsEl = document.getElementById('watchViewsCount');
        const ratingEl = document.getElementById('watchRatingScore');
        const playerWrapper = document.getElementById('watchPlayerWrapper');
        const categoryPill = document.getElementById('watchCategoryPill');
        const tagsCloud = document.getElementById('watchTagsCloud');
        const relatedGrid = document.getElementById('watchRelatedGrid');

        if (titleEl) titleEl.textContent = item.title;
        if (authorEl) authorEl.textContent = item.author;
        if (sourceEl) sourceEl.textContent = `${item.source} • Creador Oficial`;
        if (avatarEl) {
            avatarEl.src = item.author_avatar || getCreatorAvatar(item.author, item.id);
        }
        if (viewsEl) viewsEl.textContent = `👁️ ${item.views}`;
        if (ratingEl) ratingEl.textContent = `👍 ${item.rating}`;
        if (categoryPill) {
            categoryPill.textContent = item.category ? `🔥 ${item.category.toUpperCase()}` : '🔥 VIDEO HOT';
        }

        // Render Player (Iframe Embed or Native Video)
        if (playerWrapper) {
            const isShort = item.source === 'RedGifs' || item.type === 'short';
            playerWrapper.classList.toggle('vertical-short', isShort);

            let mediaTagHtml = '';
            if (item.source === 'RedGifs' || item.type === 'short') {
                const ifrUrl = item.embed_url || `https://www.redgifs.com/ifr/${item.raw_id}?autoplay=1`;
                if (item.media_url) {
                    mediaTagHtml = `<video id="activeCinemaVideo" src="${item.media_url}" controls autoplay loop playsinline referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:contain;background:#000;"></video>`;
                } else {
                    mediaTagHtml = `<iframe src="${ifrUrl}" frameborder="0" width="100%" height="100%" scrolling="no" allowfullscreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerpolicy="no-referrer"></iframe>`;
                }
            } else if (item.embed_url) {
                mediaTagHtml = `<iframe src="${item.embed_url}" frameborder="0" width="100%" height="100%" scrolling="no" allowfullscreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerpolicy="no-referrer"></iframe>`;
            } else if (item.media_url) {
                mediaTagHtml = `<video id="activeCinemaVideo" src="${item.media_url}" controls autoplay playsinline referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:contain;background:#000;"></video>`;
            } else {
                mediaTagHtml = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;min-height:300px;"><p>Reproductor no disponible para este enlace.</p></div>`;
            }

            playerWrapper.innerHTML = `
                ${mediaTagHtml}
                <div id="seekRippleLeft" class="seek-ripple-overlay left"><span>⏪ -10s</span></div>
                <div id="seekRippleRight" class="seek-ripple-overlay right"><span>+10s ⏩</span></div>
                <div id="resumePlayPrompt" class="resume-play-prompt" style="display: none;">
                    <span id="resumePlayText">▶ Continuar desde 00:00</span>
                    <div class="resume-prompt-btns">
                        <button type="button" class="btn-resume-action" onclick="window.confirmResumePlay && window.confirmResumePlay()">Reanudar</button>
                        <button type="button" class="btn-resume-dismiss" onclick="window.dismissResumePlay && window.dismissResumePlay()">✕</button>
                    </div>
                </div>
            `;

            const activeVideo = playerWrapper.querySelector('video');
            if (activeVideo) {
                activeVideo.muted = false;
                const p = activeVideo.play();
                if (p !== undefined) {
                    p.catch(() => {
                        activeVideo.muted = true;
                        activeVideo.play().catch(() => {});
                    });
                }
                setupCinemaPlayerControls(activeVideo, item);
            } else {
                saveWatchHistory(item, 0, parseDurationToSeconds(item.duration));
            }
        }

        // Check if navigated from Twitter timeline to update back link
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const fromParam = urlParams.get('from') || sessionStorage.getItem('all18_from_page');
            if (fromParam === 'twitter' || fromParam === 'twitter.html' || (document.referrer && document.referrer.includes('twitter.html'))) {
                const backBtn = document.querySelector('.btn-back-feed');
                if (backBtn) {
                    backBtn.href = 'twitter.html';
                    backBtn.innerHTML = '<span>◀</span> Volver a Timeline (𝕏)';
                }
            } else if (fromParam === 'instagram' || fromParam === 'instagram.html' || (document.referrer && document.referrer.includes('instagram.html'))) {
                const backBtn = document.querySelector('.btn-back-feed');
                if (backBtn) {
                    backBtn.href = 'instagram.html';
                    backBtn.innerHTML = '<span>◀</span> Volver a Instagram';
                }
            }
        } catch(e) {}

        // Tags
        if (tagsCloud) {
            tagsCloud.innerHTML = '';
            if (item.tags && item.tags.length > 0) {
                item.tags.forEach(t => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'tag-badge';
                    tagEl.textContent = `#${t}`;
                    tagEl.addEventListener('click', () => {
                        window.backToCatalog();
                        state.query = t;
                        if (elements.searchInput) elements.searchInput.value = t;
                        fetchContent(true);
                    });
                    tagsCloud.appendChild(tagEl);
                });
            }
        }

        // Favorite State
        const isFav = state.favorites.some(f => f.id === item.id);
        const favBtn = document.getElementById('watchFavBtn');
        if (favBtn) {
            favBtn.innerHTML = isFav ? '❤️ Guardado' : '🤍 Favorito';
            favBtn.classList.toggle('active', isFav);
        }

        // Reset Sticky PiP for new video
        state.pipDisabledForVideo = false;
        const playerCard = document.getElementById('watchPlayerCard');
        if (playerCard) playerCard.classList.remove('sticky-pip');

        // Update Comment form avatar
        const myAvatarEl = document.getElementById('commentMyAvatar');
        if (myAvatarEl) {
            myAvatarEl.src = userProfile.photoURL || CREATOR_AVATARS[0];
        }

        // Load Comments & Reactions
        loadCommentsForVideo(item.id);
        loadReactionsForVideo(item.id);

        // Render Dynamic Related Recommendations
        renderRelatedVideos('similar', 1);

        // Hide Catalog, Show Watch View
        catalogView.style.display = 'none';
        watchView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (pushHistory) {
            try {
                window.history.pushState({ view: 'watch', videoId: item.id }, item.title, '?v=' + item.id);
            } catch (e) {}
        }
    }

    // ==========================================
    // STICKY MINI-PLAYER (PICTURE-IN-PICTURE)
    // ==========================================
    window.expandStickyPiP = function () {
        const playerCard = document.getElementById('watchPlayerCard');
        if (playerCard) playerCard.classList.remove('sticky-pip');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.closeStickyPiP = function () {
        const playerCard = document.getElementById('watchPlayerCard');
        if (playerCard) playerCard.classList.remove('sticky-pip');
        state.pipDisabledForVideo = true;
    };

    // ==========================================
    // LIVE COMMENTS & HOT REACTIONS ENGINE
    // ==========================================
    async function loadCommentsForVideo(videoId) {
        const listEl = document.getElementById('commentsFeedList');
        const badgeEl = document.getElementById('commentsCountBadge');
        if (!listEl) return;

        listEl.innerHTML = '';
        let comments = [];

        // Check Local Storage
        const localKey = 'all18_comments_' + videoId;
        const cached = localStorage.getItem(localKey);
        if (cached) {
            try { comments = JSON.parse(cached); } catch (e) {}
        }

        // Check Firestore if available
        if (db && navigator.onLine) {
            try {
                const snap = await db.collection('comments')
                    .where('video_id', '==', videoId)
                    .orderBy('created_at', 'desc')
                    .limit(30)
                    .get();
                if (!snap.empty) {
                    const cloudComments = [];
                    snap.forEach(doc => cloudComments.push({ id: doc.id, ...doc.data() }));
                    comments = cloudComments;
                    localStorage.setItem(localKey, JSON.stringify(comments));
                }
            } catch (err) {
                // Ignore cloud error, keep local comments
            }
        }

        if (comments.length === 0) {
            if (badgeEl) badgeEl.textContent = '(0)';
            listEl.innerHTML = `
                <div class="empty-comments-state" style="text-align: center; padding: 28px 16px; color: #71767b; font-size: 13px;">
                    <span style="font-size: 24px; display: block; margin-bottom: 6px;">💬</span>
                    Sé el primero en comentar este video.
                </div>
            `;
            return;
        }

        if (badgeEl) badgeEl.textContent = `(${comments.length})`;

        comments.forEach(c => {
            const itemEl = document.createElement('div');
            itemEl.className = 'comment-card-item';
            itemEl.innerHTML = `
                <img src="${c.user_avatar || CREATOR_AVATARS[0]}" alt="Avatar" class="comment-item-avatar">
                <div class="comment-item-content">
                    <div class="comment-item-author-row">
                        <span class="comment-item-name">${escapeHTML(c.user_name || 'Anónimo')}</span>
                        <span class="comment-item-time">${escapeHTML(c.created_at || 'Reciente')}</span>
                    </div>
                    <p class="comment-item-text">${escapeHTML(c.text)}</p>
                </div>
            `;
            listEl.appendChild(itemEl);
        });
    }

    window.submitComment = async function () {
        const input = document.getElementById('commentTextInput');
        if (!input || !state.activeModalItem) return;
        const text = input.value.trim();
        if (!text) {
            showToast('Escribe algo en tu comentario');
            return;
        }

        const videoId = state.activeModalItem.id;
        const newComment = {
            id: 'c_' + Date.now(),
            video_id: videoId,
            user_uid: userProfile.uid,
            user_name: userProfile.handle || userProfile.displayName || 'Anónimo',
            user_avatar: userProfile.photoURL || CREATOR_AVATARS[0],
            text: text,
            created_at: 'Hace un momento'
        };

        // Prepend to UI
        const listEl = document.getElementById('commentsFeedList');
        if (listEl) {
            const itemEl = document.createElement('div');
            itemEl.className = 'comment-card-item';
            itemEl.innerHTML = `
                <img src="${newComment.user_avatar}" alt="Avatar" class="comment-item-avatar">
                <div class="comment-item-content">
                    <div class="comment-item-author-row">
                        <span class="comment-item-name">${escapeHTML(newComment.user_name)}</span>
                        <span class="comment-item-time">Ahora</span>
                    </div>
                    <p class="comment-item-text">${escapeHTML(newComment.text)}</p>
                </div>
            `;
            listEl.insertBefore(itemEl, listEl.firstChild);
        }

        // Save local
        const localKey = 'all18_comments_' + videoId;
        const cached = localStorage.getItem(localKey);
        let comments = [];
        if (cached) {
            try { comments = JSON.parse(cached); } catch (e) {}
        }
        comments.unshift(newComment);
        localStorage.setItem(localKey, JSON.stringify(comments));

        const badgeEl = document.getElementById('commentsCountBadge');
        if (badgeEl) badgeEl.textContent = `(${comments.length})`;

        // Save Firestore
        if (db && navigator.onLine) {
            try {
                await db.collection('comments').add({
                    ...newComment,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {}
        }

        input.value = '';
        showToast('💬 ¡Comentario publicado con éxito!');
    };

    window.addEmojiToComment = function (emoji) {
        const input = document.getElementById('commentTextInput');
        if (input) {
            input.value += (input.value ? ' ' : '') + emoji + ' ';
            input.focus();
        }
    };

    function loadReactionsForVideo(videoId) {
        const stored = localStorage.getItem('all18_reactions_' + videoId);
        let data = { '🔥': 14, '💦': 9, '❤️': 23, '👑': 8 };
        if (stored) {
            try { data = JSON.parse(stored); } catch (e) {}
        }
        const fire = document.getElementById('reactCount_fire');
        const water = document.getElementById('reactCount_water');
        const heart = document.getElementById('reactCount_heart');
        const crown = document.getElementById('reactCount_crown');
        if (fire) fire.textContent = data['🔥'] || 14;
        if (water) water.textContent = data['💦'] || 9;
        if (heart) heart.textContent = data['❤️'] || 23;
        if (crown) crown.textContent = data['👑'] || 8;
    }

    window.toggleReaction = function (emoji, btn) {
        if (!state.activeModalItem) return;
        const videoId = state.activeModalItem.id;
        const stored = localStorage.getItem('all18_reactions_' + videoId);
        let data = { '🔥': 14, '💦': 9, '❤️': 23, '👑': 8 };
        if (stored) {
            try { data = JSON.parse(stored); } catch (e) {}
        }

        const isAct = btn.classList.contains('active');
        if (isAct) {
            btn.classList.remove('active');
            data[emoji] = Math.max(0, (data[emoji] || 1) - 1);
        } else {
            btn.classList.add('active');
            data[emoji] = (data[emoji] || 0) + 1;
            showToast(`${emoji} ¡Reacción enviada!`);
        }

        localStorage.setItem('all18_reactions_' + videoId, JSON.stringify(data));
        loadReactionsForVideo(videoId);
    };

    // ==========================================
    // PUBLIC CREATOR PROFILE MODAL
    // ==========================================
    window.openCreatorProfile = function (targetAuthor) {
        const modal = document.getElementById('publicCreatorModal');
        if (!modal) return;

        const authorName = targetAuthor || (state.activeModalItem ? state.activeModalItem.author : 'Creador');
        const authorAvatar = state.activeModalItem ? (state.activeModalItem.author_avatar || getCreatorAvatar(authorName, state.activeModalItem.id)) : getCreatorAvatar(authorName);

        const nameEl = document.getElementById('creatorHeadName');
        const handleEl = document.getElementById('creatorHeadHandle');
        const avatarEl = document.getElementById('creatorHeadAvatar');
        const bioEl = document.getElementById('creatorHeadBio');
        const gridEl = document.getElementById('creatorVideosGrid');

        if (nameEl) nameEl.textContent = authorName;
        if (handleEl) handleEl.textContent = authorName.startsWith('@') ? authorName : '@' + authorName.replace(/\s+/g, '');
        if (avatarEl) avatarEl.src = authorAvatar || getCreatorAvatar(authorName);
        if (bioEl) bioEl.textContent = `Bienvenido al perfil oficial de ${authorName} en All18. Descubre sus mejores videos, clips HD y novedades exclusivas.`;

        if (gridEl) {
            gridEl.innerHTML = '';
            const authorVideos = (state.items || []).filter(i => (i.author || '').toLowerCase() === authorName.toLowerCase());
            const pool = authorVideos.length > 0 ? authorVideos : (state.items || []).slice(0, 6);
            pool.forEach(v => {
                const card = createVideoCard(v);
                gridEl.appendChild(card);
            });
        }

        modal.classList.add('active');
    };

    window.closeCreatorProfile = function () {
        const modal = document.getElementById('publicCreatorModal');
        if (modal) modal.classList.remove('active');
    };

    // ==========================================
    // SMART RECOMMENDATION ENGINE (VIDEOS ABAJO)
    // ==========================================
    let currentRelatedList = [];
    let currentRelatedFilter = 'similar';
    let relatedPage = 1;

    async function renderRelatedVideos(filterType = 'similar', page = 1) {
        currentRelatedFilter = filterType;
        relatedPage = page;
        const relatedGrid = document.getElementById('watchRelatedGrid');
        const countLabel = document.getElementById('relatedCountLabel');
        const pillCreator = document.getElementById('pillCreatorFilter');
        if (!relatedGrid || !state.activeModalItem) return;

        const currentItem = state.activeModalItem;
        if (pillCreator) {
            const shortAuthor = currentItem.author ? currentItem.author.replace('@', '') : 'Creador';
            pillCreator.textContent = `⭐ De ${shortAuthor.length > 12 ? shortAuthor.substring(0, 12) + '...' : shortAuthor}`;
        }

        if (page === 1) {
            relatedGrid.innerHTML = '';
        }

        let filtered = [];
        const allPool = state.items || [];

        if (filterType === 'similar') {
            const currentCat = (currentItem.category || '').toLowerCase();
            const currentTags = (currentItem.tags || []).map(t => t.toLowerCase());

            filtered = allPool.filter(i => {
                if (i.id === currentItem.id) return false;
                if (currentCat && (i.category || '').toLowerCase() === currentCat) return true;
                if (i.tags && i.tags.some(t => currentTags.includes(t.toLowerCase()))) return true;
                return false;
            });

            // Backfill with top items if list is small
            if (filtered.length < 12) {
                const remaining = allPool.filter(i => i.id !== currentItem.id && !filtered.some(f => f.id === i.id));
                filtered.push(...remaining);
            }
        } else if (filterType === 'creator') {
            const targetAuthor = (currentItem.author || '').toLowerCase();
            filtered = allPool.filter(i => i.id !== currentItem.id && (i.author || '').toLowerCase() === targetAuthor);
            if (filtered.length === 0) {
                filtered = allPool.filter(i => i.id !== currentItem.id).slice(0, 10);
            }
        } else if (filterType === 'shorts') {
            filtered = allPool.filter(i => i.id !== currentItem.id && (i.type === 'short' || i.source === 'RedGifs'));
        } else {
            // Category filter
            filtered = allPool.filter(i => {
                if (i.id === currentItem.id) return false;
                const catMatch = (i.category || '').toLowerCase().includes(filterType);
                const tagMatch = (i.tags || []).some(t => t.toLowerCase().includes(filterType));
                const titleMatch = (i.title || '').toLowerCase().includes(filterType);
                return catMatch || tagMatch || titleMatch;
            });
        }

        // Live API stream if few recommendations exist
        if (filtered.length < 8) {
            try {
                const queryTerm = filterType === 'similar' ? (currentItem.category || 'hot') : filterType;
                const res = await fetch(`api.php?action=search&source=all&q=${encodeURIComponent(queryTerm)}&page=${page}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.data && data.data.length > 0) {
                        const newItems = data.data.filter(i => i.id !== currentItem.id && !filtered.some(f => f.id === i.id));
                        filtered.push(...newItems);
                        state.items.push(...newItems);
                    }
                }
            } catch (err) {}
        }

        const pageSize = 12;
        const startIndex = (page - 1) * pageSize;
        const pageItems = filtered.slice(startIndex, startIndex + pageSize);

        currentRelatedList = filtered;

        if (page === 1 && pageItems.length === 0) {
            relatedGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px 10px; color: var(--text-muted);">
                    <p>No se encontraron videos adicionales en esta categoría.</p>
                </div>
            `;
        } else {
            pageItems.forEach(item => {
                const card = createVideoCard(item);
                relatedGrid.appendChild(card);
            });
        }

        if (countLabel) {
            countLabel.textContent = `(${filtered.length}+ sugerencias)`;
        }

        const btnLoadMore = document.getElementById('btnLoadMoreRelated');
        if (btnLoadMore) {
            btnLoadMore.style.display = (startIndex + pageSize < filtered.length) ? 'flex' : 'none';
        }
    }

    window.filterRelatedVideos = function (filterType, element) {
        document.querySelectorAll('.related-pill').forEach(p => p.classList.remove('active'));
        if (element) element.classList.add('active');
        renderRelatedVideos(filterType, 1);
    };

    window.loadMoreRelatedVideos = function () {
        relatedPage++;
        renderRelatedVideos(currentRelatedFilter, relatedPage);
    };

    window.playNextRecommendedVideo = function () {
        if (currentRelatedList && currentRelatedList.length > 0) {
            const nextItem = currentRelatedList[0];
            openWatchView(nextItem);
            showToast(`▶ Siguiente: ${nextItem.title}`);
        } else {
            showToast('No hay más videos en la cola de recomendados');
        }
    };

    window.backToCatalog = function (pushHistory = true) {
        if (window.location.pathname.includes('watch.html') || window.location.pathname.includes('watch.php') || document.body.classList.contains('watch-page-body')) {
            const urlParams = new URLSearchParams(window.location.search);
            const from = (urlParams.get('from') || sessionStorage.getItem('all18_from_page') || '').toLowerCase();
            if (from === 'hub' || from.includes('hub') || (document.referrer && document.referrer.includes('hub.html'))) {
                window.location.href = 'hub.html';
                return;
            }
            if (from === 'tiktok' || from.includes('tiktok') || (document.referrer && document.referrer.includes('tiktok.html'))) {
                window.location.href = 'tiktok.html';
                return;
            }
            if (from === 'twitter' || from.includes('twitter') || (document.referrer && document.referrer.includes('twitter.html'))) {
                window.location.href = 'twitter.html';
                return;
            }
            if (from === 'onlyfans' || from.includes('onlyfans')) {
                window.location.href = 'onlyfans.html';
                return;
            }
            if (from === 'instagram' || from.includes('instagram')) {
                window.location.href = 'instagram.html';
                return;
            }
            if (document.referrer && document.referrer.includes('.html')) {
                window.location.href = document.referrer;
                return;
            }
            window.location.href = 'index.html';
            return;
        }
        const catalogView = document.getElementById('catalogView');
        const watchView = document.getElementById('watchView');
        const playerWrapper = document.getElementById('watchPlayerWrapper');

        if (playerWrapper) playerWrapper.innerHTML = '';
        if (watchView) watchView.style.display = 'none';
        if (catalogView) catalogView.style.display = 'block';
        state.activeModalItem = null;

        if (pushHistory) {
            try {
                window.history.pushState({ view: 'catalog' }, 'All18', window.location.pathname);
            } catch (e) {}
        }
    };

    window.toggleWatchFavorite = function () {
        if (state.activeModalItem) {
            toggleFavorite(state.activeModalItem);
            const isFav = state.favorites.some(f => f.id === state.activeModalItem.id);
            const favBtn = document.getElementById('watchFavBtn');
            if (favBtn) {
                favBtn.innerHTML = isFav ? '❤️ Guardado' : '🤍 Favorito';
                favBtn.classList.toggle('active', isFav);
            }
        }
    };

    function getPublicShareUrl(item) {
        if (!item) return '';
        // If url is already an official external HTTP link
        if (item.url && typeof item.url === 'string' && item.url.startsWith('http') && 
            !item.url.includes('androidplatform.net') && !item.url.includes('android_asset')) {
            return item.url;
        }

        const embedUrl = item.embed_url || '';
        if (embedUrl.includes('pornhub.com/embed/')) {
            const id = embedUrl.split('/embed/')[1]?.split(/[?&#]/)[0] || item.raw_id || (item.id ? item.id.replace(/^ph_/, '') : '');
            return `https://www.pornhub.com/view_video.php?viewkey=${id}`;
        }
        if (embedUrl.includes('xvideos.com/embedframe/')) {
            const id = embedUrl.split('/embedframe/')[1]?.split(/[?&#]/)[0] || item.raw_id;
            return `https://www.xvideos.com/video.${id}/`;
        }
        if (embedUrl.includes('xnxx.com/embedframe/')) {
            const id = embedUrl.split('/embedframe/')[1]?.split(/[?&#]/)[0] || item.raw_id;
            return `https://www.xnxx.com/video-${id}/`;
        }
        if (embedUrl.includes('spankbang.com/')) {
            const id = embedUrl.replace(/.*spankbang\.com\//, '').replace(/\/embed\/?/, '').split(/[?&#]/)[0];
            return `https://spankbang.com/${id}/video/`;
        }
        if (embedUrl.includes('eporner.com/embed/')) {
            const id = embedUrl.split('/embed/')[1]?.split('/')[0];
            return `https://www.eporner.com/video/${id}/`;
        }
        if (embedUrl.includes('redgifs.com/ifr/')) {
            const id = embedUrl.split('/ifr/')[1]?.split(/[?&#]/)[0];
            return `https://www.redgifs.com/watch/${id}`;
        }
        if (embedUrl.includes('redtube.com/')) {
            const id = embedUrl.split('/redtube.com/')[1]?.split(/[?&#]/)[0];
            return `https://www.redtube.com/${id}`;
        }
        if (embedUrl.includes('youporn.com/embed/')) {
            const id = embedUrl.split('/embed/')[1]?.split(/[?&#]/)[0];
            return `https://www.youporn.com/watch/${id}/`;
        }
        if (item.media_url && typeof item.media_url === 'string' && item.media_url.startsWith('http')) {
            return item.media_url;
        }
        if (embedUrl.startsWith('http') && !embedUrl.includes('androidplatform.net')) {
            return embedUrl;
        }
        if (item.title) {
            return `https://www.pornhub.com/video/search?search=${encodeURIComponent(item.title)}`;
        }
        return '';
    }
    window.getPublicShareUrl = getPublicShareUrl;

    window.shareVideoItem = function (item) {
        if (!item) return;
        const shareUrl = getPublicShareUrl(item);
        if (!shareUrl) {
            showToast('No se encontró enlace público para compartir');
            return;
        }
        const title = item.title || 'Video All18';

        if (window.AndroidApp && typeof window.AndroidApp.shareLink === 'function') {
            window.AndroidApp.shareLink(title, shareUrl);
            return;
        }

        if (navigator.share) {
            navigator.share({ title: title, url: shareUrl }).catch(() => {});
            return;
        }

        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast('🔗 ¡Enlace oficial copiado al portapapeles!');
            }).catch(() => {
                showToast('URL: ' + shareUrl);
            });
        } else {
            showToast('URL: ' + shareUrl);
        }
    };

    window.shareCurrentVideo = function () {
        if (state.activeModalItem) {
            window.shareVideoItem(state.activeModalItem);
        }
    };

    window.openNewInstance = function (url) {
        const target = url || 'index.html';
        if (window.AndroidApp && typeof window.AndroidApp.openNewInstance === 'function') {
            window.AndroidApp.openNewInstance(target);
        } else {
            window.open(target, '_blank');
        }
    };

    window.requestPipMode = function () {
        if (window.AndroidApp && typeof window.AndroidApp.enterPipMode === 'function') {
            const ok = window.AndroidApp.enterPipMode();
            if (!ok) {
                showToast('Modo PiP flotante no soportado en este dispositivo');
            }
        } else {
            const video = document.querySelector('video');
            if (video && document.pictureInPictureEnabled) {
                video.requestPictureInPicture().catch(() => {
                    showToast('PiP no disponible');
                });
            } else {
                showToast('PiP flotante disponible en app All18 Android');
            }
        }
    };

    window.openVideoInNewInstance = function () {
        const currentUrl = window.location.href;
        window.openNewInstance(currentUrl);
    };

    window.toggleFollowCreator = function () {
        const btn = document.getElementById('btnFollowCreator');
        if (!btn) return;
        if (btn.classList.contains('following')) {
            btn.classList.remove('following');
            btn.textContent = '+ Seguir';
            showToast('Dejaste de seguir a este creador');
        } else {
            btn.classList.add('following');
            btn.textContent = '✓ Siguiendo';
            showToast('🌟 ¡Ahora sigues a este creador!');
        }
    };

    // =========================================================
    // CINEMA PLAYER PRO & GESTURES ENGINE (v1.3.1)
    // =========================================================
    function setupCinemaPlayerControls(video, item) {
        if (!video) return;

        const speedLabel = document.getElementById('speedValueLabel');
        if (speedLabel) speedLabel.textContent = `${video.playbackRate}x`;

        // Check for saved progress in watch history
        const history = getWatchHistory();
        const saved = history.find(h => h.id === item.id);
        if (saved && saved.currentTime > 5 && saved.currentTime < (saved.durationSec - 10)) {
            const resumePrompt = document.getElementById('resumePlayPrompt');
            const resumeText = document.getElementById('resumePlayText');
            if (resumePrompt && resumeText) {
                resumeText.textContent = `▶ Continuar desde ${formatSecondsToTime(saved.currentTime)}`;
                resumePrompt.style.display = 'flex';
                window._pendingResumeTime = saved.currentTime;
                setTimeout(() => {
                    if (resumePrompt) resumePrompt.style.display = 'none';
                }, 10000);
            }
        }

        // Throttle progress save to every 3 seconds
        let lastSaveTime = 0;
        video.addEventListener('timeupdate', () => {
            const now = Date.now();
            if (now - lastSaveTime > 3000) {
                lastSaveTime = now;
                saveWatchHistory(item, video.currentTime, video.duration);
            }
        });

        // Double-tap gesture seeking
        let lastTapTime = 0;
        let lastTapX = 0;
        const wrapper = document.getElementById('watchPlayerWrapper');
        if (wrapper && !wrapper._hasTapListener) {
            wrapper._hasTapListener = true;
            wrapper.addEventListener('click', (e) => {
                if (e.target.closest('.resume-play-prompt') || e.target.closest('.pip-controls-bar') || e.target.closest('.player-pro-toolbar')) return;

                const currentTime = Date.now();
                const tapLength = currentTime - lastTapTime;
                const rect = wrapper.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;

                if (tapLength < 350 && tapLength > 60) {
                    // Double tap detected!
                    if (clickX < width * 0.4) {
                        window.seekVideo(-10);
                    } else if (clickX > width * 0.6) {
                        window.seekVideo(10);
                    }
                    e.preventDefault();
                }
                lastTapTime = currentTime;
                lastTapX = clickX;
            });
        }
    }

    window.confirmResumePlay = function() {
        const video = document.getElementById('activeCinemaVideo') || document.querySelector('#watchPlayerWrapper video');
        const resumePrompt = document.getElementById('resumePlayPrompt');
        if (video && window._pendingResumeTime) {
            video.currentTime = window._pendingResumeTime;
            video.play().catch(() => {});
            showToast(`▶ Reanudado desde ${formatSecondsToTime(window._pendingResumeTime)}`);
        }
        if (resumePrompt) resumePrompt.style.display = 'none';
    };

    window.dismissResumePlay = function() {
        const resumePrompt = document.getElementById('resumePlayPrompt');
        if (resumePrompt) resumePrompt.style.display = 'none';
    };

    window.seekVideo = function(seconds) {
        const video = document.getElementById('activeCinemaVideo') || document.querySelector('#watchPlayerWrapper video');
        const rippleId = seconds < 0 ? 'seekRippleLeft' : 'seekRippleRight';
        const ripple = document.getElementById(rippleId);

        if (ripple) {
            ripple.classList.remove('active');
            void ripple.offsetWidth;
            ripple.classList.add('active');
            setTimeout(() => ripple.classList.remove('active'), 600);
        }

        if (video) {
            const newTime = Math.max(0, Math.min(video.duration || 99999, video.currentTime + seconds));
            video.currentTime = newTime;
            showToast(`${seconds > 0 ? '⏩ +' : '⏪ '}${seconds}s (${formatSecondsToTime(newTime)})`);
        } else {
            showToast(`${seconds > 0 ? '⏩ +10s' : '⏪ -10s'} (Usa los controles del portal)`);
        }
    };

    const SPEED_OPTIONS = [0.5, 1.0, 1.25, 1.5, 2.0];
    window.cyclePlaybackSpeed = function() {
        const video = document.getElementById('activeCinemaVideo') || document.querySelector('#watchPlayerWrapper video');
        const currentSpeed = video ? video.playbackRate : (parseFloat(document.getElementById('speedValueLabel')?.textContent) || 1.0);
        const currentIdx = SPEED_OPTIONS.indexOf(currentSpeed);
        const nextSpeed = SPEED_OPTIONS[(currentIdx + 1) % SPEED_OPTIONS.length];

        if (video) {
            video.playbackRate = nextSpeed;
        }
        const speedLabel = document.getElementById('speedValueLabel');
        if (speedLabel) speedLabel.textContent = `${nextSpeed}x`;
        showToast(`⚡ Velocidad de reproducción: ${nextSpeed}x`);
    };

    let isScreenLandscape = false;
    window.togglePlayerOrientation = function() {
        isScreenLandscape = !isScreenLandscape;
        if (window.AndroidApp && typeof window.AndroidApp.toggleOrientation === 'function') {
            window.AndroidApp.toggleOrientation(isScreenLandscape);
        } else if (screen.orientation && screen.orientation.lock) {
            if (isScreenLandscape) {
                screen.orientation.lock('landscape').catch(() => {});
            } else {
                screen.orientation.unlock();
            }
        }
        showToast(`🔄 Pantalla: ${isScreenLandscape ? 'Horizontal (Sensor Landscape)' : 'Vertical'}`);
    };

    let sleepTimerTimeout = null;
    let sleepTimerMinutes = 0;
    window.openSleepTimerModal = function() {
        const modal = document.getElementById('sleepTimerModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeSleepTimerModal = function() {
        const modal = document.getElementById('sleepTimerModal');
        if (modal) modal.style.display = 'none';
    };

    window.setSleepTimer = function(minutes) {
        if (sleepTimerTimeout) {
            clearTimeout(sleepTimerTimeout);
            sleepTimerTimeout = null;
        }
        sleepTimerMinutes = minutes;
        const badge = document.getElementById('sleepTimerBadge');

        if (minutes > 0) {
            if (badge) badge.textContent = `${minutes}m 💤`;
            showToast(`💤 Temporizador: se pausará en ${minutes} min`);
            sleepTimerTimeout = setTimeout(() => {
                const video = document.getElementById('activeCinemaVideo') || document.querySelector('#watchPlayerWrapper video');
                if (video) video.pause();
                if (badge) badge.textContent = 'Dormir';
                sleepTimerMinutes = 0;
                showToast('💤 Temporizador finalizado. Reproducción pausada para descansar.');
            }, minutes * 60 * 1000);
        } else {
            if (badge) badge.textContent = 'Dormir';
            showToast('Temporizador desactivado');
        }
        window.closeSleepTimerModal();
    };

    window.downloadCurrentVideo = function() {
        const item = state.activeModalItem;
        if (!item) {
            showToast('No hay video activo para descargar');
            return;
        }

        const video = document.getElementById('activeCinemaVideo') || document.querySelector('#watchPlayerWrapper video');
        const downloadUrl = (video && video.src && !video.src.startsWith('blob:')) ? video.src : (item.media_url || item.hd_url || item.sd_url || '');

        if (downloadUrl && downloadUrl.startsWith('http')) {
            const cleanTitle = (item.title || 'Video_All18').replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 40);
            const filename = `All18_${cleanTitle}.mp4`;
            if (window.AndroidApp && typeof window.AndroidApp.downloadMedia === 'function') {
                window.AndroidApp.downloadMedia(downloadUrl, filename);
            } else {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                showToast('📥 Descarga iniciada');
            }
        } else {
            const shareUrl = item.embed_url || item.url || window.location.href;
            if (window.AndroidApp && typeof window.AndroidApp.copyToClipboard === 'function') {
                window.AndroidApp.copyToClipboard(shareUrl);
                showToast('📋 Enlace de stream copiado para gestor de descargas');
            } else {
                navigator.clipboard?.writeText(shareUrl);
                showToast('📋 Enlace de stream copiado al portapapeles');
            }
        }
    };

    function toggleFavorite(item) {
        const index = state.favorites.findIndex(f => f.id === item.id);
        if (index > -1) {
            state.favorites.splice(index, 1);
            showToast('Eliminado de favoritos');
        } else {
            state.favorites.unshift(item);
            showToast('❤️ Guardado en tus favoritos');
        }
        localStorage.setItem('all18_favorites', JSON.stringify(state.favorites));
        updateFavoritesBadge();

        document.querySelectorAll(`.card-fav-btn[data-id="${item.id}"]`).forEach(btn => {
            const isFav = index === -1;
            btn.classList.toggle('active', isFav);
            btn.innerHTML = isFav ? '❤️' : '🤍';
        });

        if (state.activeModalItem && state.activeModalItem.id === item.id) {
            const isFav = index === -1;
            elements.modalFavBtn.innerHTML = isFav ? '❤️ Guardado' : '🤍 Favorito';
        }

        if (state.view === 'favorites') {
            renderFavorites();
        }
    }

    function updateFavoritesBadge() {
        if (elements.favCountBadge) {
            elements.favCountBadge.textContent = state.favorites.length;
            elements.favCountBadge.style.display = state.favorites.length > 0 ? 'flex' : 'none';
        }
    }

    function renderFavorites() {
        if (!elements.grid) return;
        elements.grid.innerHTML = '';

        if (elements.toolbarTitle) elements.toolbarTitle.innerHTML = 'Mis Videos Favoritos';
        if (elements.itemCount) elements.itemCount.textContent = `(${state.favorites.length} guardados)`;
        if (elements.loadMoreBtn) elements.loadMoreBtn.style.display = 'none';

        if (state.favorites.length === 0) {
            elements.grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px;">
                    <div style="font-size: 48px; margin-bottom: 12px;">🤍</div>
                    <h3 style="font-size: 22px; margin-bottom: 8px;">Aún no tienes favoritos guardados</h3>
                    <p style="color: var(--text-dim);">Haz clic en el corazón de cualquier video o corto para guardarlo aquí.</p>
                </div>
            `;
            return;
        }

        renderCards(state.favorites);
    }

    function showToast(message) {
        if (!elements.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    function getSkeletonHTML(count = 12) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-card">
                    <div class="skeleton-thumb skeleton-shimmer"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-line title skeleton-shimmer"></div>
                        <div class="skeleton-line author skeleton-shimmer"></div>
                        <div class="skeleton-line stats skeleton-shimmer"></div>
                    </div>
                </div>
            `;
        }
        return html;
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }

    // ==========================================
    // FIREBASE AUTHENTICATION (GOOGLE SIGN-IN)
    // ==========================================
    const firebaseConfig = {
        apiKey: "AIzaSyAOSzI-2A2RXNuCyNlr0wt6o7Vn6Q8JCAY",
        authDomain: "vesqzzio.firebaseapp.com",
        projectId: "vesqzzio",
        storageBucket: "vesqzzio.firebasestorage.app",
        messagingSenderId: "333515687473",
        appId: "1:333515687473:web:d35cd6dfbb96d1bc0e7710",
        measurementId: "G-ZH4RQJQT8D"
    };

    // ==========================================
    // COMPLETE USER PROFILE, FIRESTORE & ANONYMOUS SYSTEM
    // ==========================================
    const DEFAULT_PROFILE = {
        uid: '',
        displayName: 'Usuario All18',
        handle: '@usuario',
        email: '',
        photoURL: CREATOR_AVATARS[0],
        bio: 'Creador y miembro de la comunidad All18.',
        is_anonymous: false,
        is_onboarded: false
    };

    const ANONYMOUS_AVATARS = CREATOR_AVATARS;

    const RANDOM_NICKNAMES = [
        'DiablaHot', 'LatinLover', 'GatitaVIP', 'MisterBlack', 'FenixHot',
        'Diosa18', 'ChicoMisterio', 'ReinaLatina', 'SeductorX', 'SirenaHot',
        'AfroditaVIP', 'LoboNocturno', 'BellaSensual', 'TitanHot', 'PasionLatina'
    ];

    let userProfile = { ...DEFAULT_PROFILE };
    window.userProfile = userProfile;
    let auth = null;
    let db = null;
    let currentUser = null;
    let isLoggingIn = false;
    let selectedIdentityMode = 'anon';
    let selectedAnonAvatarUrl = ANONYMOUS_AVATARS[0];

    // Load cached profile immediately from localStorage (0ms latency)
    try {
        const savedProfile = localStorage.getItem('all18_user_profile');
        if (savedProfile) {
            userProfile = { ...DEFAULT_PROFILE, ...JSON.parse(savedProfile) };
        }
    } catch (e) {
        console.warn('Could not read cached user profile:', e);
    }

    function initFirebase() {
        // Sync with local profile first immediately
        updateAuthUI(userProfile);

        if (typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                auth = firebase.auth();
                if (firebase.firestore) {
                    db = firebase.firestore();
                }

                auth.onAuthStateChanged(user => {
                    if (user) {
                        currentUser = user;
                        syncUserFromGoogle(user);
                    }
                });

                // Catch Google redirect result on mobile/redirect flows
                auth.getRedirectResult().then(result => {
                    if (result && result.user) {
                        currentUser = result.user;
                        syncUserFromGoogle(result.user);
                    }
                }).catch(err => {
                    console.warn('Redirect result warning:', err);
                });
            } catch (e) {
                console.warn('Firebase init warning:', e);
            }
        }
    }

    // Update UI based on Auth State
    function updateAuthUI(profile) {
        const btnLogin = document.getElementById('btnGoogleLogin');
        const userMenu = document.getElementById('userProfileMenu');
        const userAvatar = document.getElementById('userAvatarImg');
        const userName = document.getElementById('userNameSpan');
        const dropName = document.getElementById('userDropdownName');
        const dropEmail = document.getElementById('userDropdownEmail');
        const btnPublish = document.getElementById('btnOpenPublish'); // The global Upload button

        const isLoggedIn = profile && profile.uid && !profile.is_anonymous;
        if (isLoggedIn) {
            if (btnLogin) btnLogin.style.display = 'none';
            if (userMenu) userMenu.style.display = 'block';
            if (userAvatar) userAvatar.src = profile.photoURL || CREATOR_AVATARS[0];
            if (userName) userName.textContent = profile.displayName || 'Usuario';
            if (dropName) dropName.textContent = profile.displayName || 'Usuario';
            if (dropEmail) dropEmail.textContent = profile.email || profile.handle || '';
            
            // Show Publish Button if logged in
            if (btnPublish) btnPublish.style.display = 'flex';
        } else {
            if (btnLogin) btnLogin.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
            
            // Hide Publish Button if logged out
            if (btnPublish) btnPublish.style.display = 'none';
        }
    }

    async function syncUserFromGoogle(user) {
        if (!user) return;
        userProfile.uid = user.uid;
        userProfile.email = user.email || '';

        const gName = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario');
        if (!userProfile.displayName || userProfile.displayName === 'Usuario All18') {
            userProfile.displayName = gName;
            userProfile.handle = '@' + gName.toLowerCase().replace(/[^a-z0-9_]/g, '');
        }
        if (!userProfile.photoURL || userProfile.photoURL === DEFAULT_PROFILE.photoURL) {
            userProfile.photoURL = user.photoURL || DEFAULT_PROFILE.photoURL;
        }

        userProfile.is_onboarded = true;

        // Immediately persist to localStorage and refresh UI (0ms delay)
        try {
            localStorage.setItem('all18_user_profile', JSON.stringify(userProfile));
        } catch (e) {}

        updateAuthUI(userProfile);
        showToast(`👋 ¡Bienvenido ${userProfile.displayName}!`);

        // Check Firestore in background
        if (db) {
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                if (doc.exists) {
                    const cloudProfile = doc.data();
                    if (cloudProfile && cloudProfile.displayName) {
                        userProfile = { ...userProfile, ...cloudProfile };
                        localStorage.setItem('all18_user_profile', JSON.stringify(userProfile));
                        updateAuthUI(userProfile);
                    }
                } else {
                    saveProfileToFirestore(userProfile);
                }
            } catch (e) {
                console.warn('Firestore sync warning:', e);
            }
        }
    }

    async function saveProfileToFirestore(profile) {
        if (!db || !profile.uid) return;
        try {
            await db.collection('users').doc(profile.uid).set({
                uid: profile.uid,
                displayName: profile.displayName,
                handle: profile.handle,
                photoURL: profile.photoURL,
                bio: profile.bio || '',
                is_anonymous: !!profile.is_anonymous,
                is_onboarded: true,
                email: profile.email || '',
                updated_at: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.warn('Firestore save warning:', err);
        }
    }

    // ==========================================
    // IDENTITY ONBOARDING MODAL LOGIC
    // ==========================================
    window.openIdentityModal = function (user = null) {
        const modal = document.getElementById('identityModal');
        if (!modal) return;

                const gallery = document.getElementById('anonAvatarGallery');
        if (gallery) {
            gallery.innerHTML = '';
            ANONYMOUS_AVATARS.forEach((url, idx) => {
                const item = document.createElement('div');
                item.className = 'avatar-gallery-item' + (idx === 0 ? ' selected' : '');
                if (idx > 0) item.style.display = 'none'; // hide by default
                item.innerHTML = '<img src="' + url + '" alt="Avatar ' + (idx + 1) + '">';
                item.onclick = () => window.selectAnonAvatar(url, item);
                gallery.appendChild(item);
            });
            const btnMore = document.getElementById('btnShowMoreAvatars');
            if (btnMore) {
                btnMore.onclick = () => {
                    const items = gallery.querySelectorAll('.avatar-gallery-item');
                    items.forEach(i => i.style.display = 'block');
                    btnMore.style.display = 'none';
                };
                btnMore.style.display = 'block';
            }
        }
        window.selectIdentityMode('anon');

        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.closeIdentityModal = function () {
        const modal = document.getElementById('identityModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    window.selectIdentityMode = function (mode) {
        selectedIdentityMode = mode;
        const cardAnon = document.getElementById('cardModeAnon');
        const cardGoogle = document.getElementById('cardModeGoogle');
        const anonArea = document.getElementById('anonConfigArea');

        if (mode === 'anon') {
            if (cardAnon) cardAnon.classList.add('selected');
            if (cardGoogle) cardGoogle.classList.remove('selected');
            if (anonArea) anonArea.style.display = 'flex';
        } else {
            if (cardGoogle) cardGoogle.classList.add('selected');
            if (cardAnon) cardAnon.classList.remove('selected');
            if (anonArea) anonArea.style.display = 'none';
        }
    };

    window.rollRandomNickname = function () {
        const randomName = RANDOM_NICKNAMES[Math.floor(Math.random() * RANDOM_NICKNAMES.length)];
        const input = document.getElementById('inputAnonHandle');
        if (input) {
            input.value = randomName;
        }
    };

    window.selectAnonAvatar = function (url, element) {
        selectedAnonAvatarUrl = url;
        document.querySelectorAll('.avatar-gallery-item').forEach(item => item.classList.remove('selected'));
        if (element) element.classList.add('selected');
    };

    window.saveIdentityConfig = async function () {
        const btnSave = document.getElementById('btnSaveIdentity');
        if (btnSave) {
            btnSave.innerHTML = '<span class="spinner"></span> Guardando perfil...';
            btnSave.disabled = true;
        }

        if (selectedIdentityMode === 'anon') {
            const input = document.getElementById('inputAnonHandle');
            const cleanName = (input ? input.value.trim() : '') || 'DiablaHot';
            userProfile.is_anonymous = true;
            userProfile.displayName = cleanName;
            userProfile.handle = '@' + cleanName.replace(/[^a-zA-Z0-9_]/g, '');
            userProfile.photoURL = selectedAnonAvatarUrl;
            userProfile.bio = 'Creador en All18. 🔥';
            if (!userProfile.uid) userProfile.uid = 'usr_' + Date.now();
        } else {
            const googleUser = currentUser || {};
            const googleName = googleUser.displayName || 'Usuario';
            userProfile.is_anonymous = false;
            userProfile.displayName = googleName;
            userProfile.handle = '@' + googleName.toLowerCase().replace(/[^a-z0-9_]/g, '');
            userProfile.photoURL = googleUser.photoURL || DEFAULT_PROFILE.photoURL;
            userProfile.bio = 'Creador y miembro de la comunidad All18.';
            if (!userProfile.uid) userProfile.uid = googleUser.uid || 'usr_' + Date.now();
        }

        userProfile.is_onboarded = true;

        try {
            localStorage.setItem('all18_user_profile', JSON.stringify(userProfile));
        } catch (e) {}

        await saveProfileToFirestore(userProfile);
        updateAuthUI(userProfile);
        window.closeIdentityModal();

        if (btnSave) {
            btnSave.innerHTML = '🚀 Guardar Identidad y Continuar';
            btnSave.disabled = false;
        }

        showToast(`✨ ¡Perfil activo como ${userProfile.displayName}!`);
    };

            
    window.openThemeModal = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const modal = document.getElementById('themeModal');
        if (modal) {
            const currentTheme = document.body.dataset.theme || localStorage.getItem('all18_theme') || 'pornhub';
            modal.querySelectorAll('.theme-modal-item').forEach(item => {
                item.classList.toggle('active', item.dataset.theme === currentTheme);
            });
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeThemeModal = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const modal = document.getElementById('themeModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    window.selectTheme = function (themeName) {
        window.applyTheme(themeName, true);
        window.closeThemeModal();
    };

    window.toggleThemeMenu = window.openThemeModal;

    window.applyTheme = function (themeName, notify = true) {
        document.body.dataset.theme = themeName;
        localStorage.setItem('all18_theme', themeName);

        const themeNames = {
            pornhub: 'All18 Tube (Pornhub)',
            onlyfans: 'OnlyFans / Fansly',
            instagram: 'Instagram / Reels',
            tiktok: 'TikTok / Shorts',
            twitter: 'X',
            amoled: 'AMOLED Negro Puro'
        };

        if (themeName === 'amoled') {
            let amoledLink = document.getElementById('amoledThemeLink');
            if (!amoledLink && !document.querySelector('link[href*="theme-amoled.css"]')) {
                amoledLink = document.createElement('link');
                amoledLink.id = 'amoledThemeLink';
                amoledLink.rel = 'stylesheet';
                amoledLink.href = 'css/themes/theme-amoled.css';
                document.head.appendChild(amoledLink);
            }
        }

        document.querySelectorAll('.theme-modal-item, .theme-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeName);
        });

        // If switching to TikTok, reload feed with dedicated vertical shorts
        if (themeName === 'tiktok') {
            state.source = 'redgifs';
            state.view = 'shorts';
            if (typeof loadVideos === 'function') {
                loadVideos(1, true);
            }
            setTimeout(() => {
                const firstCard = document.querySelector('.video-card');
                if (firstCard) {
                    const firstVid = firstCard.querySelector('.feed-video-player');
                    if (firstVid) {
                        firstVid.play().then(() => {
                            firstCard.classList.add('video-playing');
                        }).catch(() => {});
                    }
                }
            }, 500);
        }

        if (notify && typeof showToast === 'function') {
            showToast('Tema activado: ' + (themeNames[themeName] || themeName));
        }
    };


    // User Avatar Dropdown toggle
    document.addEventListener('click', (e) => {
        const avatarBtn = e.target.closest('#userAvatarBtn');
        const userDropdown = document.getElementById('userDropdown');
        if (avatarBtn && userDropdown) {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        } else if (userDropdown && !e.target.closest('#userDropdown')) {
            userDropdown.classList.remove('active');
        }
    });

    // Global Helper Handlers
        window.openPublishModal = function () {
        const dd = document.getElementById('userDropdown');
        if (dd) dd.classList.remove('active');
        // Enforce Google Sign-In requirement to publish
        const isLoggedIn = userProfile && userProfile.uid && userProfile.email;
        if (!isLoggedIn) {
            const authModal = document.getElementById('authRequiredModal');
            if (authModal) {
                authModal.classList.add('active');
                authModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } else {
                showToast('🔒 Debes iniciar sesión con Google para publicar videos');
                window.loginWithGoogle();
            }
            return;
        }

        // Fill and lock author field with user's verified identity
        const authInp = document.getElementById('publishAuthor');
        if (authInp) {
            authInp.value = userProfile.handle || userProfile.displayName || '@CreadorAll18';
            authInp.readOnly = true;
            authInp.style.opacity = '0.85';
            authInp.style.cursor = 'not-allowed';
        }

        const modal = document.getElementById('publishModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeAuthRequiredModal = function () {
        const authModal = document.getElementById('authRequiredModal');
        if (authModal) {
            authModal.classList.remove('active');
            authModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    window.closePublishModal = function () {
        const modal = document.getElementById('publishModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    window.switchPublishTab = function (mode) {
        state.publishMode = mode;
        const tabLink = document.getElementById('tabLinkBtn');
        const tabFile = document.getElementById('tabFileBtn');
        const linkGroup = document.getElementById('linkInputGroup');
        const fileGroup = document.getElementById('fileInputGroup');
        if (mode === 'link') {
            if (tabLink) tabLink.classList.add('active');
            if (tabFile) tabFile.classList.remove('active');
            if (linkGroup) linkGroup.style.display = 'flex';
            if (fileGroup) fileGroup.style.display = 'none';
        } else {
            if (tabFile) tabFile.classList.add('active');
            if (tabLink) tabLink.classList.remove('active');
            if (linkGroup) linkGroup.style.display = 'none';
            if (fileGroup) fileGroup.style.display = 'flex';
        }
    };

    window.confirmAge = function () {
        localStorage.setItem('all18_age_verified', 'true');
        const ageGate = document.getElementById('welcomeModal');
        if (ageGate) {
            ageGate.classList.remove('active');
            ageGate.style.display = 'none';
        }
    };

    // Publishing System Engine
    function setupPublishEngine() {
        const btnOpen = document.getElementById('btnOpenPublish');
        const modal = document.getElementById('publishModal');
        const closeBtn = document.getElementById('publishCloseBtn');

        if (btnOpen) {
            btnOpen.addEventListener('click', (e) => {
                e.preventDefault();
                window.openPublishModal();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.closePublishModal();
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) window.closePublishModal();
            });
        }

        const tabLink = document.getElementById('tabLinkBtn');
        const tabFile = document.getElementById('tabFileBtn');
        if (tabLink) tabLink.addEventListener('click', () => window.switchPublishTab('link'));
        if (tabFile) tabFile.addEventListener('click', () => window.switchPublishTab('file'));

        const pubUrl = document.getElementById('publishUrl');
        if (pubUrl) {
            pubUrl.addEventListener('input', () => {
                const rawUrl = pubUrl.value.trim();
                if (!rawUrl) return;

                const pubTitle = document.getElementById('publishTitle');
                if (pubTitle && !pubTitle.value) {
                    if (rawUrl.includes('redgifs.com')) {
                        const match = rawUrl.match(/watch\/([a-zA-Z0-9]+)/i) || rawUrl.match(/ifr\/([a-zA-Z0-9]+)/i) || rawUrl.match(/redgifs\.com\/([a-zA-Z0-9]+)/i);
                        if (match) {
                            pubTitle.value = 'Clip Exclusivo ' + match[1];
                        }
                    } else if (rawUrl.includes('pornhub.com')) {
                        pubTitle.value = 'Video Hot All18';
                    }
                }
            });
        }

        if(elements.dropzone) elements.dropzone.addEventListener('click', () => {
            elements.publishFile.click();
        });

        if(elements.dropzone) elements.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropzone.classList.add('dragover');
        });

        if(elements.dropzone) elements.dropzone.addEventListener('dragleave', () => {
            elements.dropzone.classList.remove('dragover');
        });

        if(elements.dropzone) elements.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleVideoFile(e.dataTransfer.files[0]);
            }
        });

        if(elements.publishFile) elements.publishFile.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleVideoFile(e.target.files[0]);
            }
        });

        function handleVideoFile(file) {
            if (!file.type.startsWith('video/')) {
                showToast('Por favor selecciona un video válido (.mp4, .webm)');
                return;
            }

            state.uploadedVideoBlob = URL.createObjectURL(file);
            elements.previewVideoTag.src = state.uploadedVideoBlob;
            elements.videoFilePreview.style.display = 'block';

            if (!elements.publishTitle.value) {
                const nameClean = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
                elements.publishTitle.value = nameClean;
            }

            elements.previewVideoTag.addEventListener('loadeddata', () => {
                elements.previewVideoTag.currentTime = 1;
            });

            elements.previewVideoTag.addEventListener('seeked', () => {
                try {
                    const canvas = elements.thumbCanvas;
                    canvas.width = elements.previewVideoTag.videoWidth || 640;
                    canvas.height = elements.previewVideoTag.videoHeight || 360;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(elements.previewVideoTag, 0, 0, canvas.width, canvas.height);
                    state.generatedThumbnail = canvas.toDataURL('image/jpeg', 0.85);
                    showToast('📸 Miniatura de video generada con éxito');
                } catch (err) {
                    console.warn('Canvas error:', err);
                }
            }, { once: true });
        }

        if(elements.publishForm) elements.publishForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Enforce Google Sign-In on submission
            const isLoggedIn = userProfile && userProfile.uid && userProfile.email;
            if (!isLoggedIn) {
                showToast('🔒 Debes iniciar sesión con Google para publicar videos');
                window.closePublishModal();
                const authModal = document.getElementById('authRequiredModal');
                if (authModal) {
                    authModal.classList.add('active');
                    authModal.style.display = 'flex';
                } else {
                    window.loginWithGoogle();
                }
                return;
            }

            const title = elements.publishTitle.value.trim();
            const author = userProfile.handle || userProfile.displayName || elements.publishAuthor.value.trim() || '@CreadorAll18';
            const category = elements.publishCategory.value;
            const tags = elements.publishTags.value.split(',').map(t => t.trim()).filter(Boolean);

            if (!title) {
                showToast('Por favor escribe un título');
                return;
            }

            let embedUrl = '';
            let mediaUrl = '';
            let thumb = state.generatedThumbnail || FALLBACK_THUMB;
            let duration = 'HD Video';

            if (state.publishMode === 'link') {
                const url = elements.publishUrl.value.trim();
                if (!url) {
                    showToast('Por favor pega un enlace de video');
                    return;
                }

                if (url.includes('redgifs.com')) {
                    const match = url.match(/watch\/([a-zA-Z0-9]+)/i) || url.match(/ifr\/([a-zA-Z0-9]+)/i) || url.match(/redgifs\.com\/([a-zA-Z0-9]+)/i);
                    const id = match ? match[1] : '';
                    embedUrl = `https://www.redgifs.com/ifr/${id}?autoplay=1`;
                    thumb = `https://media.redgifs.com/${id}-poster.jpg`;
                    duration = 'Short / GIF';
                } else if (url.includes('pornhub.com')) {
                    const match = url.match(/viewkey=([a-zA-Z0-9]+)/i);
                    const key = match ? match[1] : '';
                    embedUrl = `https://www.pornhub.com/embed/${key}`;
                    duration = '12:00';
                } else if (url.includes('redtube.com')) {
                    const match = url.match(/redtube\.com\/([0-9]+)/i);
                    const id = match ? match[1] : '';
                    embedUrl = `https://embed.redtube.com/?id=${id}`;
                    duration = '09:30';
                } else if (url.endsWith('.mp4') || url.endsWith('.webm')) {
                    mediaUrl = url;
                    duration = 'Direct Stream';
                } else {
                    embedUrl = url;
                }
            } else {
                if (!state.uploadedVideoBlob) {
                    showToast('Por favor selecciona un video para subir');
                    return;
                }
                mediaUrl = state.uploadedVideoBlob;
                duration = 'Video Local';
            }

            elements.btnSubmitPublish.innerHTML = '<span class="spinner"></span> Publicando...';
            elements.btnSubmitPublish.disabled = true;

            const postPayload = {
                title,
                author: userProfile.handle || author,
                author_name: userProfile.displayName || author,
                author_uid: userProfile.uid || '',
                author_avatar: userProfile.photoURL || '',
                category,
                tags,
                embed_url: embedUrl,
                media_url: mediaUrl,
                thumb,
                duration
            };

            let createdPost = null;

            try {
                const res = await fetch('api.php?action=publish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(postPayload)
                });
                const data = await res.json();
                if (data.status === 'success' && data.post) {
                    createdPost = data.post;
                }
            } catch (err) {
                console.warn('Publish API error, falling back:', err);
            }

            if (!createdPost) {
                createdPost = {
                    id: 'user_' + Date.now(),
                    title,
                    author: userProfile.handle || author,
                    author_name: userProfile.displayName || author,
                    author_uid: userProfile.uid || '',
                    author_avatar: userProfile.photoURL || '',
                    category,
                    tags,
                    embed_url: embedUrl,
                    media_url: mediaUrl,
                    thumb,
                    thumbs: [thumb],
                    duration,
                    views: '1 vista',
                    rating: '100%',
                    source: '🌟 Creador All18',
                    is_user_post: true,
                    type: mediaUrl ? 'short' : 'video',
                    quality: '1080p HD'
                };
            }

            renderCards([createdPost], true);
            state.items.unshift(createdPost);
            updateProfileStats();

            elements.btnSubmitPublish.innerHTML = '<span>🚀</span> Publicar Video Ahora';
            elements.btnSubmitPublish.disabled = false;

            closePublishModal();
            elements.publishForm.reset();
            elements.videoFilePreview.style.display = 'none';
            state.generatedThumbnail = null;
            state.uploadedVideoBlob = null;

            showToast('🎉 ¡Tu video ha sido publicado con éxito en All18!');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function closePublishModal() {
        if (!elements.publishModal) return;
        elements.publishModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function setupEventListeners() {
        if (elements.searchForm) {
                        elements.searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const q = elements.searchInput.value.trim();
                if (window.location.pathname.includes('watch.html') || window.location.pathname.includes('watch.php') || document.body.classList.contains('watch-page-body')) {
                    window.location.href = 'index.html?q=' + encodeURIComponent(q);
                    return;
                }
                state.query = q;
                state.view = 'videos';
                window.backToCatalog(true);
                fetchContent(true);
            });
        }

                if (elements.sourceSelect) {
            elements.sourceSelect.addEventListener('change', (e) => {
                state.source = e.target.value;
                if (state.source === 'redgifs') {
                    if (elements.toolbarTitle) elements.toolbarTitle.innerHTML = 'Shorts & GIFs (RedGifs)';
                } else {
                    if (elements.toolbarTitle) elements.toolbarTitle.innerHTML = 'Videos Populares';
                }
                fetchContent(true);
            });
        }
        if (elements.qualitySelect) {
            elements.qualitySelect.addEventListener('change', () => fetchContent(true));
        }
        if (elements.durationSelect) {
            elements.durationSelect.addEventListener('change', () => fetchContent(true));
        }

        elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.filter = btn.dataset.filter;
                fetchContent(true);
            });
        });

        elements.navLinks.forEach(link => {
            link.addEventListener('click', () => {
                elements.navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                const targetView = link.dataset.view;

                const catWrapper = document.querySelector('.categories-bar-wrapper');
                
                if (targetView === 'favorites') {
                    if (catWrapper) catWrapper.style.display = 'none';
                    state.view = 'favorites';
                    renderFavorites();
                } else if (targetView === 'shorts') {
                    if (catWrapper) catWrapper.style.display = 'none';
                    state.view = 'shorts';
                    state.source = 'redgifs';
                    if (elements.sourceSelect) elements.sourceSelect.value = 'redgifs';
                    if (elements.toolbarTitle) elements.toolbarTitle.innerHTML = 'Shorts & GIFs Hot (RedGifs)';
                    fetchContent(true);
                } else {
                    if (catWrapper) catWrapper.style.display = 'block';
                    state.view = 'videos';
                    state.source = 'all';
                    if (elements.sourceSelect) elements.sourceSelect.value = 'all';
                    if (elements.toolbarTitle) elements.toolbarTitle.innerHTML = 'Videos Populares';
                    fetchContent(true);
                }
            });
        });

        if (elements.loadMoreBtn) {
            elements.loadMoreBtn.addEventListener('click', () => {
                state.page++;
                fetchContent(false);
            });
        }

        // Browser Back Button & URL Navigation
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view === 'watch' && e.state.videoId) {
                const targetItem = (state.items || []).find(i => i.id === e.state.videoId);
                if (targetItem) {
                    openWatchView(targetItem, false);
                }
            } else {
                window.backToCatalog(false);
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const watchView = document.getElementById('watchView');
                if (watchView && watchView.style.display !== 'none') {
                    window.backToCatalog();
                }
                if (elements.publishModal && elements.publishModal.classList.contains('active')) {
                    closePublishModal();
                }
                const profileModal = document.getElementById('userProfileModal');
                if (profileModal && profileModal.classList.contains('active')) {
                    window.closeProfileModal();
                }
                const creatorModal = document.getElementById('publicCreatorModal');
                if (creatorModal && creatorModal.classList.contains('active')) {
                    window.closeCreatorProfile();
                }
                const authModal = document.getElementById('authRequiredModal');
                if (authModal && authModal.classList.contains('active')) {
                    window.closeAuthRequiredModal();
                }
            }
        });

        const profileModal = document.getElementById('userProfileModal');
        if (profileModal) {
            profileModal.addEventListener('click', (e) => {
                if (e.target === profileModal) window.closeProfileModal();
            });
        }

        const idModal = document.getElementById('identityModal');
        if (idModal) {
            idModal.addEventListener('click', (e) => {
                if (e.target === idModal) window.closeIdentityModal();
            });
        }

        const creatorModal = document.getElementById('publicCreatorModal');
        if (creatorModal) {
            creatorModal.addEventListener('click', (e) => {
                if (e.target === creatorModal) window.closeCreatorProfile();
            });
        }

        const authModal = document.getElementById('authRequiredModal');
        if (authModal) {
            authModal.addEventListener('click', (e) => {
                if (e.target === authModal) window.closeAuthRequiredModal();
            });
        }

        // Sticky Mini-Player on Scroll
        window.addEventListener('scroll', () => {
            const watchView = document.getElementById('watchView');
            const playerCard = document.getElementById('watchPlayerCard');
            if (watchView && watchView.style.display !== 'none' && playerCard && !state.pipDisabledForVideo) {
                if (window.scrollY > 420) {
                    playerCard.classList.add('sticky-pip');
                } else if (window.scrollY < 150) {
                    playerCard.classList.remove('sticky-pip');
                }
            }
        });

        // Search Autocomplete Suggestions Dropdown
        const searchInp = elements.searchInput || document.getElementById('searchInput');
        const searchSugg = document.getElementById('searchSuggestions');
        if (searchInp && searchSugg) {
            searchInp.addEventListener('focus', () => {
                searchSugg.classList.add('active');
            });
            searchInp.addEventListener('input', () => {
                searchSugg.classList.add('active');
            });
                        ['mousedown', 'touchstart'].forEach(evt => {
                document.addEventListener(evt, (e) => {
                    if (!e.target.closest('.search-wrapper')) {
                        searchSugg.classList.remove('active');
                    }
                }, {passive: true});
            });
            searchSugg.querySelectorAll('.suggestion-item').forEach(item => {
                                item.addEventListener('click', () => {
                    const term = item.dataset.search;
                    searchInp.value = term;
                    searchSugg.classList.remove('active');
                    if (window.location.pathname.includes('watch.html') || window.location.pathname.includes('watch.php')) {
                        window.location.href = 'index.html?q=' + encodeURIComponent(term);
                        return;
                    }
                    state.query = term;
                    window.backToCatalog();
                    fetchContent(true);
                });
            });
        }

        if (elements.btnWelcomeEnter) {
            elements.btnWelcomeEnter.addEventListener('click', () => {
                localStorage.setItem('all18_age_verified', 'true');
                if (elements.ageGate) elements.ageGate.classList.remove('active');
            });
        }
        if (elements.btnWelcomeLeave) {
            elements.btnWelcomeLeave.addEventListener('click', () => {
                window.location.href = 'https://www.google.com';
            });
        }

        if (elements.themeDropdownBtn && elements.themeMenu) {

            document.querySelectorAll('.theme-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    const theme = opt.dataset.theme;
                    window.applyTheme(theme);
                    if (elements.themeMenu) elements.themeMenu.classList.remove('active');
                });
            });
        }

        // Global Universal Click/Touch Delegation
        document.addEventListener('click', (e) => {
            // Publish button
            const pubBtn = e.target.closest('#btnOpenPublish') || e.target.closest('.btn-publish');
            if (pubBtn) {
                e.preventDefault();
                window.openPublishModal();
                return;
            }

            // Google Login button
            const googleBtn = e.target.closest('#btnGoogleLogin') || e.target.closest('.btn-google-login');
            if (googleBtn) {
                e.preventDefault();
                window.loginWithGoogle();
                return;
            }

            

            // Close Theme menu on outer click
            if (!e.target.closest('.theme-dropdown')) {
                const menu = document.getElementById('themeMenu');
                if (menu) menu.classList.remove('active');
            }
        });
    }


    // ==========================================
    // GOOGLE LOGIN HANDLER
    // ==========================================
    window.loginWithGoogle = async function () {
        if (typeof firebase === 'undefined' || !auth) {
            try { initFirebase(); } catch(e) {}
        }
        if (!auth) {
            showToast('Conectando con Google...');
            return;
        }

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');

            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
                await auth.signInWithRedirect(provider);
            } else {
                const result = await auth.signInWithPopup(provider);
                if (result && result.user) {
                    await syncUserFromGoogle(result.user);
                    window.closeProfileModal();
                    window.openProfileModal();
                }
            }
        } catch (err) {
            console.warn('Google Sign-In Error:', err);
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                const result = await auth.signInWithPopup(provider);
                if (result && result.user) {
                    await syncUserFromGoogle(result.user);
                    window.closeProfileModal();
                    window.openProfileModal();
                }
            } catch (e2) {
                console.error('Popup fallback error:', e2);
                showToast('Error al conectar con Google');
            }
        }
    };

    window.logoutUser = async function () {
        try {
            if (auth) await auth.signOut();
            userProfile = { ...DEFAULT_PROFILE };
            localStorage.removeItem('all18_user_profile');
            updateAuthUI(userProfile);
            window.closeProfileModal();
            showToast('Sesión cerrada correctamente');
        } catch (e) {
            console.error('Logout error:', e);
        }
    };

    // =========================================================================
    // PROFILE MANAGEMENT (TIKTOK & UNIVERSAL THEME ADAPTED)
    // =========================================================================
    window.openProfileModal = function (tab = 'videos') {
        const isTikTok = document.body.dataset.theme === 'tiktok' || document.body.classList.contains('tiktok-standalone-body');
        const ttModal = document.getElementById('tiktokProfileModal');
        const standardModal = document.getElementById('userProfileModal');

        const isLoggedIn = !!(userProfile && userProfile.uid && !userProfile.is_anonymous);

        if (isTikTok && ttModal) {
            const loggedOutView = document.getElementById('ttLoggedOutView');
            const loggedInView = document.getElementById('ttLoggedInView');

            if (!isLoggedIn) {
                if (loggedOutView) loggedOutView.style.display = 'flex';
                if (loggedInView) loggedInView.style.display = 'none';
            } else {
                if (loggedOutView) loggedOutView.style.display = 'none';
                if (loggedInView) loggedInView.style.display = 'flex';
                window.updateTikTokProfileData();
            }

            ttModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            return;
        }

        // Standard profile modal fallback
        if (standardModal) {
            window.updateStandardProfileData();
            window.switchProfileTab(tab);
            standardModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeProfileModal = function () {
        const ttModal = document.getElementById('tiktokProfileModal');
        if (ttModal) ttModal.classList.remove('active');

        const standardModal = document.getElementById('userProfileModal');
        if (standardModal) standardModal.classList.remove('active');

        document.body.style.overflow = '';
    };

    window.updateTikTokProfileData = function () {
        const nameEl = document.getElementById('ttProfileName');
        const headerTitleEl = document.getElementById('ttHeaderTitle');
        const handleEl = document.getElementById('ttProfileHandle');
        const avatarEl = document.getElementById('ttProfileAvatar');
        const storyEl = document.getElementById('ttStoryAvatar');
        const statFavsEl = document.getElementById('ttStatLikes');

        const dispName = userProfile.displayName || 'Usuario';
        const dispHandle = userProfile.handle || ('@' + dispName.toLowerCase().replace(/[^a-z0-9_]/g, ''));
        const dispAvatar = userProfile.photoURL || CREATOR_AVATARS[0];

        if (nameEl) nameEl.textContent = dispName;
        if (headerTitleEl) headerTitleEl.textContent = dispName;
        if (handleEl) handleEl.textContent = dispHandle;
        if (avatarEl) avatarEl.src = dispAvatar;
        if (storyEl) storyEl.src = dispAvatar;
        if (statFavsEl) statFavsEl.textContent = state.favorites ? state.favorites.length : '0';

        window.renderTikTokProfileVideos();
    };

    window.renderTikTokProfileVideos = function () {
        const grid = document.getElementById('ttUserVideosGrid');
        const emptyBox = document.getElementById('ttNoVideosBox');
        if (!grid) return;

        grid.innerHTML = '';
        const myVideos = (state.userPosts || []).filter(p => p.author === userProfile.displayName || p.is_user_post);

        if (myVideos.length === 0) {
            if (emptyBox) emptyBox.style.display = 'flex';
            grid.style.display = 'none';
        } else {
            if (emptyBox) emptyBox.style.display = 'none';
            grid.style.display = 'grid';
            myVideos.forEach(v => {
                const item = document.createElement('div');
                item.className = 'tt-grid-item';
                item.innerHTML = `
                    <img src="${v.thumb || FALLBACK_THUMB}" alt="${escapeHTML(v.title || '')}" />
                    <span class="tt-grid-views">▶ ${v.views || '1.2K'}</span>
                `;
                item.onclick = () => openWatchView(v, true);
                grid.appendChild(item);
            });
        }
    };

    window.switchTikTokProfileTab = function (tab) {
        document.querySelectorAll('.tt-profile-nav-tabs .tt-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        const paneVideos = document.getElementById('ttPaneVideos');
        const paneFavs = document.getElementById('ttPaneFavs');

        if (tab === 'videos') {
            if (paneVideos) paneVideos.style.display = 'block';
            if (paneFavs) paneFavs.style.display = 'none';
            window.renderTikTokProfileVideos();
        } else if (tab === 'favorites' || tab === 'liked') {
            if (paneVideos) paneVideos.style.display = 'none';
            if (paneFavs) paneFavs.style.display = 'block';
            
            const favGrid = document.getElementById('ttUserFavsGrid');
            const noFavs = document.getElementById('ttNoFavsBox');
            if (favGrid) {
                favGrid.innerHTML = '';
                const favs = state.favorites || [];
                if (favs.length === 0) {
                    if (noFavs) noFavs.style.display = 'flex';
                    favGrid.style.display = 'none';
                } else {
                    if (noFavs) noFavs.style.display = 'none';
                    favGrid.style.display = 'grid';
                    favs.forEach(f => {
                        const item = document.createElement('div');
                        item.className = 'tt-grid-item';
                        item.innerHTML = `
                            <img src="${f.thumb || FALLBACK_THUMB}" alt="${escapeHTML(f.title || '')}" />
                            <span class="tt-grid-views">❤️ ${f.duration || 'Short'}</span>
                        `;
                        item.onclick = () => openWatchView(f, true);
                        favGrid.appendChild(item);
                    });
                }
            }
        } else {
            if (paneVideos) paneVideos.style.display = 'block';
            if (paneFavs) paneFavs.style.display = 'none';
        }
    };


    // =========================================================================
    // X (TWITTER) 1:1 FULLSCREEN MEDIA LIGHTBOX PLAYER
    // =========================================================================
    window.currentXModalItem = null;

    function resolveVideoSources(item) {
        if (!item) return { mediaUrl: '', embedUrl: '', isPhoto: false };
        const isUserPost = !!item.is_user_post;
        const isExplicitPhoto = item.type === 'photo';

        // 1. Direct Video Streams (MP4 / WebM / CDN Previews)
        let mediaUrl = item.media_url || item.preview_url || item.preview_video || item.hd_url || item.sd_url || (isUserPost && item.video_url ? item.video_url : '') || '';
        let embedUrl = item.embed_url || '';
        const rawId = item.raw_id || (item.id ? String(item.id).replace(/^[a-z]+_/, '') : '');
        const id = String(item.id || '');

        if (item.source === 'RedGifs' || id.startsWith('rg_')) {
            if (rawId) {
                if (!mediaUrl) mediaUrl = `https://media.redgifs.com/${rawId}.mp4`;
                if (!embedUrl) embedUrl = `https://www.redgifs.com/ifr/${rawId}?autoplay=1`;
            }
        }

        // Provider URL resolution based on standard ID prefixes and sources
        if (!mediaUrl && !embedUrl && rawId) {
            if (id.startsWith('ph_') || item.source === 'Pornhub') {
                embedUrl = `https://www.pornhub.com/embed/${rawId}`;
            } else if (id.startsWith('xv_') || item.source === 'XVideos') {
                embedUrl = `https://www.xvideos.com/embedframe/${rawId}`;
            } else if (id.startsWith('xn_') || item.source === 'XNXX') {
                embedUrl = `https://www.xnxx.com/embedframe/${rawId}`;
            } else if (id.startsWith('yp_') || item.source === 'YouPorn') {
                embedUrl = `https://www.youporn.com/embed/${rawId}`;
            } else if (id.startsWith('rt_') || item.source === 'RedTube') {
                embedUrl = `https://embed.redtube.com/?id=${rawId}`;
            } else if (id.startsWith('ep_') || item.source === 'Eporner') {
                embedUrl = `https://www.eporner.com/embed/${rawId}/`;
            }
        }

        if (!embedUrl && item.url && !item.url.endsWith('.mp4') && !item.url.endsWith('.webm')) {
            embedUrl = item.url;
        }
        if (!mediaUrl && item.url && (item.url.endsWith('.mp4') || item.url.endsWith('.webm') || item.url.includes('.mp4?'))) {
            mediaUrl = item.url;
        }

        // Determine if this is truly a photo post
        const isPhoto = isExplicitPhoto || (!item.duration && !mediaUrl && !embedUrl && (item.photo_url || item.image_url));

        return { mediaUrl, embedUrl, isPhoto };
    }

    window.openCurrentWatchCinema = function(targetSection = '') {
        const item = window.currentXModalItem || window.currentIgModalItem;
        if (!item) return;
        try {
            sessionStorage.setItem('all18_current_watch', JSON.stringify(item));
            localStorage.setItem('all18_current_watch', JSON.stringify(item));
            const fromPage = window.location.pathname.includes('instagram.html') ? 'instagram' : 'twitter';
            sessionStorage.setItem('all18_from_page', fromPage + '.html');
        } catch(e) {}
        if (typeof window.closeXMediaModal === 'function') window.closeXMediaModal(false);
        if (typeof window.closeIgMediaModal === 'function') window.closeIgMediaModal(false);
        const fromPage = window.location.pathname.includes('instagram.html') ? 'instagram' : 'twitter';
        const hash = targetSection === 'comments' ? '#watchCommentsSection' : '';
        window.location.href = `watch.html?v=${encodeURIComponent(item.id)}&from=${fromPage}${hash}`;
    };

    window.openWatchCinemaItem = function(itemId) {
        const item = (state.items && state.items.find(i => String(i.id) === String(itemId))) || { id: itemId };
        try {
            sessionStorage.setItem('all18_current_watch', JSON.stringify(item));
            localStorage.setItem('all18_current_watch', JSON.stringify(item));
            const fromPage = window.location.pathname.includes('instagram.html') ? 'instagram' : 'twitter';
            sessionStorage.setItem('all18_from_page', fromPage + '.html');
        } catch(e) {}
        const fromPage = window.location.pathname.includes('instagram.html') ? 'instagram' : 'twitter';
        window.location.href = `watch.html?v=${encodeURIComponent(itemId)}&from=${fromPage}`;
    };

    window.openXMediaModal = function(item) {
        if (!item) return;
        window.currentXModalItem = item;

        const modal = document.getElementById('xMediaModal');
        const mediaContainer = document.getElementById('xLightboxMedia');
        if (!modal || !mediaContainer) return;

        // Pause any running videos in the feed to avoid competing sound/decoders
        document.querySelectorAll('.feed-video-player').forEach(v => {
            try { v.pause(); } catch(e) {}
        });

        const { mediaUrl, embedUrl, isPhoto } = resolveVideoSources(item);
        const initialThumb = item.thumb || FALLBACK_THUMB;

        // Clear previous media
        mediaContainer.innerHTML = '';

        function renderEmbedPlayer(ifrSrc) {
            let finalUrl = ifrSrc;
            if (!finalUrl.includes('autoplay=')) {
                finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'autoplay=1';
            }
            mediaContainer.innerHTML = `
                <div class="x-lightbox-iframe-container">
                    <iframe id="xLightboxIframe" src="${finalUrl}" frameborder="0" width="100%" height="100%" scrolling="no" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" referrerpolicy="no-referrer"></iframe>
                    <button type="button" class="x-lightbox-cinema-floating-btn" onclick="window.openCurrentWatchCinema && window.openCurrentWatchCinema()" title="Ver en Modo Cine">
                        <span>🎬 Modo Cine</span>
                    </button>
                </div>
            `;
        }

        if (isPhoto) {
            const photoUrl = item.image_url || item.photo_url || item.thumb || initialThumb;
            const wrapper = document.createElement('div');
            wrapper.className = 'x-lightbox-photo-wrapper';
            wrapper.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000; overflow: auto; padding: 8px;';
            wrapper.innerHTML = `
                <img id="xLightboxPhoto" src="${photoUrl}" alt="${escapeHTML(item.title || 'Foto HD')}" style="max-width: 100%; max-height: 85vh; object-fit: contain; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.8);" />
            `;
            mediaContainer.appendChild(wrapper);
            if (window.AlgorithmEngine) {
                window.AlgorithmEngine.recordEngagement(item, 'photo_click', { context: 'x' });
            }
        } else if (mediaUrl) {
            // Render native video player with sound button & full controls
            const wrapper = document.createElement('div');
            wrapper.className = 'x-lightbox-video-wrapper';
            wrapper.innerHTML = `
                <video id="xLightboxVideo" class="x-lightbox-video" src="${mediaUrl}" poster="${initialThumb}" autoplay loop playsinline controls referrerpolicy="no-referrer"></video>
                <button type="button" class="x-lightbox-sound-btn" id="xLbSoundBtn" title="Activar/Silenciar sonido">
                    <span class="x-sound-icon">🔊</span>
                    <span class="x-sound-text">Sonido</span>
                </button>
            `;
            mediaContainer.appendChild(wrapper);

            const v = wrapper.querySelector('video');
            const soundBtn = wrapper.querySelector('#xLbSoundBtn');

            function updateSoundUI(muted) {
                if (!soundBtn) return;
                const icon = soundBtn.querySelector('.x-sound-icon');
                const text = soundBtn.querySelector('.x-sound-text');
                if (muted) {
                    if (icon) icon.textContent = '🔇';
                    if (text) text.textContent = 'Activar Sonido';
                    soundBtn.classList.add('muted');
                } else {
                    if (icon) icon.textContent = '🔊';
                    if (text) text.textContent = 'Sonido';
                    soundBtn.classList.remove('muted');
                }
            }

            if (soundBtn && v) {
                soundBtn.onclick = (e) => {
                    e.stopPropagation();
                    v.muted = !v.muted;
                    updateSoundUI(v.muted);
                    if (v.paused) v.play().catch(() => {});
                };
            }

            if (v) {
                // Video tap toggle
                v.onclick = (e) => {
                    if (v.muted) {
                        v.muted = false;
                        updateSoundUI(false);
                    }
                };

                // Autoplay with sound attempt (inside user gesture of opening post)
                v.muted = false;
                v.volume = 1.0;
                const playPromise = v.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        updateSoundUI(false);
                    }).catch((err) => {
                        console.warn('Unmuted autoplay blocked, falling back to muted:', err);
                        v.muted = true;
                        v.play().catch(() => {});
                        updateSoundUI(true);
                    });
                }

                // If direct video fails to load, fallback to embed iframe if available
                v.onerror = () => {
                    console.warn('Direct video error, attempting embed fallback:', item.id);
                    if (embedUrl) {
                        renderEmbedPlayer(embedUrl);
                    }
                };
            }
        } else if (embedUrl) {
            renderEmbedPlayer(embedUrl);
        } else {
            mediaContainer.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; padding: 24px; text-align: center;">
                    <img src="${initialThumb}" alt="${escapeHTML(item.title || 'Video')}" style="max-width: 80%; max-height: 50%; object-fit: contain; border-radius: 12px; margin-bottom: 16px;" />
                    <button type="button" onclick="window.openCurrentWatchCinema && window.openCurrentWatchCinema()" style="background: #1d9bf0; color: #fff; border: none; border-radius: 9999px; padding: 12px 24px; font-weight: 700; font-size: 14px; cursor: pointer;">
                        ▶ Reproducir en Modo Cine
                    </button>
                </div>
            `;
        }

        // Populate Creator Info in Header
        const avatarEl = document.getElementById('xLbAvatar');
        const authorEl = document.getElementById('xLbAuthor');
        const handleEl = document.getElementById('xLbHandle');
        const captionEl = document.getElementById('xLbCaption');

        const authorHandle = (item.author || 'creador').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'all18creator';
        const authorAvatar = item.author_avatar || getCreatorAvatar(item.author, item.id);

        if (avatarEl) avatarEl.src = authorAvatar;
        if (authorEl) authorEl.textContent = item.author || 'Creador Oficial';
        if (handleEl) handleEl.textContent = '@' + authorHandle;
        if (captionEl) {
            captionEl.innerHTML = escapeHTML(item.title || '').replace(/(#[a-zA-Z0-9_]+)/g, '<span class="x-hashtag">$1</span>');
        }

        // Realistic stats
        const seed = Math.abs(String(item.id || '123').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
        const rawLikes = (seed * 123) % 95000 + 1200;
        const formattedLikes = rawLikes > 999 ? (rawLikes / 1000).toFixed(1) + ' mil' : rawLikes;
        const commentsCount = (seed % 650) + 24;
        const repostsCount = (seed % 880) + 50;
        const viewsCount = item.views || ((seed * 345) % 800000 + 10000 > 999 ? Math.floor(((seed * 345) % 800000 + 10000) / 1000) + ' mil' : '142 mil');

        const replyEl = document.getElementById('xLbReplyCount');
        const repostEl = document.getElementById('xLbRepostCount');
        const likeEl = document.getElementById('xLbLikeCount');
        const viewsEl = document.getElementById('xLbViewsCount');

        if (replyEl) replyEl.innerText = commentsCount;
        if (repostEl) repostEl.innerText = repostsCount;
        if (likeEl) likeEl.innerText = formattedLikes;
        if (viewsEl) viewsEl.innerText = viewsCount;

        // Button events
        const likeBtn = document.getElementById('xLbLikeBtn');
        if (likeBtn) {
            const isFav = state.favorites.some(f => f.id === item.id);
            likeBtn.style.color = isFav ? '#f91880' : '#71767b';
            likeBtn.onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                const nowFav = state.favorites.some(f => f.id === item.id);
                likeBtn.style.color = nowFav ? '#f91880' : '#71767b';
                AlgorithmEngine.recordEngagement(item, 'like');
                showToast(nowFav ? '❤️ Me gusta guardado' : 'Me gusta eliminado');
            };
        }

        const repostBtn = document.getElementById('xLbRepostBtn');
        if (repostBtn) {
            repostBtn.onclick = (e) => {
                e.stopPropagation();
                const isActive = repostBtn.style.color === 'rgb(0, 186, 124)' || repostBtn.style.color === '#00ba7c';
                repostBtn.style.color = isActive ? '#71767b' : '#00ba7c';
                showToast(isActive ? 'Repost eliminado' : '🔁 Reposteado en tu perfil');
            };
        }

        const replyBtn = document.getElementById('xLbReplyBtn');
        if (replyBtn) {
            replyBtn.onclick = (e) => {
                e.stopPropagation();
                window.openCurrentWatchCinema('comments');
            };
        }

        const shareBtn = document.getElementById('xLbShareBtn');
        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.stopPropagation();
                window.shareVideoItem(item);
            };
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        try {
            history.pushState({ modal: 'xMediaModal' }, '');
        } catch(e) {}
    };

    window.closeXMediaModal = function(popHistory = true) {
        const modal = document.getElementById('xMediaModal');
        const mediaContainer = document.getElementById('xLightboxMedia');
        if (modal) {
            if (mediaContainer) {
                const v = mediaContainer.querySelector('video');
                if (v) {
                    try { v.pause(); v.removeAttribute('src'); v.load(); } catch(e) {}
                }
                const ifr = mediaContainer.querySelector('iframe');
                if (ifr) {
                    try { ifr.src = 'about:blank'; } catch(e) {}
                }
                mediaContainer.innerHTML = '';
            }
            window.currentXModalItem = null;
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';

            if (popHistory && history.state && history.state.modal === 'xMediaModal') {
                try { history.back(); } catch(e) {}
            }
        }
    };

    window.addEventListener('popstate', (e) => {
        const modal = document.getElementById('xMediaModal');
        if (modal && modal.classList.contains('active')) {
            window.closeXMediaModal(false);
        }
    });

    // =========================================================================
    // INSTAGRAM 1:1 FULLSCREEN REELS / PLAYER VIEWER
    // =========================================================================
    window.currentIgModalItem = null;

    window.openIgMediaModal = function(item) {
        if (!item) return;
        window.currentIgModalItem = item;

        const modal = document.getElementById('igMediaModal');
        const mediaContainer = document.getElementById('igLightboxMedia');
        if (!modal || !mediaContainer) return;

        // Pause any running videos in the feed to avoid competing audio
        document.querySelectorAll('.feed-video-player').forEach(v => {
            try { v.pause(); } catch(e) {}
        });

        const { mediaUrl, embedUrl, isPhoto } = resolveVideoSources(item);
        const initialThumb = item.thumb || FALLBACK_THUMB;

        mediaContainer.innerHTML = '';

        function renderIgEmbed(ifrSrc) {
            let finalUrl = ifrSrc;
            if (!finalUrl.includes('autoplay=')) {
                finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'autoplay=1';
            }
            mediaContainer.innerHTML = `
                <div style="width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; background: #000; border-radius: 18px; overflow: hidden;">
                    <iframe src="${finalUrl}" frameborder="0" width="100%" height="100%" scrolling="no" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen="true" referrerpolicy="no-referrer" style="border: none; border-radius: 18px; width: 100%; height: 100%; object-fit: contain;"></iframe>
                    <button type="button" class="ig-reel-cinema-overlay-btn" onclick="window.openCurrentWatchCinema && window.openCurrentWatchCinema()" title="Ver en Pantalla Completa / Modo Cine">
                        <span>🎬 Modo Cine</span>
                    </button>
                </div>
            `;
        }

        if (isPhoto) {
            const photoUrl = item.image_url || item.photo_url || initialThumb;
            mediaContainer.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000; border-radius: 18px;">
                    <img src="${photoUrl}" alt="${escapeHTML(item.title || 'Foto HD')}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 18px;" />
                </div>
            `;
            if (window.AlgorithmEngine) {
                window.AlgorithmEngine.recordEngagement(item, 'photo_click', { context: 'instagram' });
            }
        } else if (mediaUrl) {
            mediaContainer.innerHTML = `
                <div style="width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; background: #000; border-radius: 18px;">
                    <video class="ig-reel-video" src="${mediaUrl}" poster="${initialThumb}" autoplay loop playsinline controls style="width: 100%; height: 100%; object-fit: contain; background: #000; border-radius: 18px;"></video>
                    <button type="button" class="ig-reel-sound-btn" id="igLbSoundBtn" title="Activar/Silenciar sonido">
                        <span class="ig-sound-icon">🔊</span>
                    </button>
                    <button type="button" class="ig-reel-cinema-overlay-btn" onclick="window.openCurrentWatchCinema && window.openCurrentWatchCinema()" title="Ver en Pantalla Completa / Modo Cine">
                        <span>🎬 Modo Cine</span>
                    </button>
                </div>
            `;

            const v = mediaContainer.querySelector('video');
            const soundBtn = mediaContainer.querySelector('#igLbSoundBtn');

            function updateIgSoundUI(muted) {
                if (!soundBtn) return;
                const icon = soundBtn.querySelector('.ig-sound-icon');
                if (icon) icon.textContent = muted ? '🔇' : '🔊';
            }

            if (soundBtn && v) {
                soundBtn.onclick = (e) => {
                    e.stopPropagation();
                    v.muted = !v.muted;
                    updateIgSoundUI(v.muted);
                    if (v.paused) v.play().catch(() => {});
                };
            }

            if (v) {
                v.onclick = (e) => {
                    if (v.muted) {
                        v.muted = false;
                        updateIgSoundUI(false);
                    }
                };

                v.muted = false;
                v.volume = 1.0;
                const p = v.play();
                if (p !== undefined) {
                    p.then(() => updateIgSoundUI(false)).catch(() => {
                        v.muted = true;
                        v.play().catch(() => {});
                        updateIgSoundUI(true);
                    });
                }
                v.onerror = () => {
                    console.warn('Direct Reel video error, attempting embed fallback:', item.id);
                    if (embedUrl) {
                        renderIgEmbed(embedUrl);
                    }
                };
            }
        } else if (embedUrl) {
            renderIgEmbed(embedUrl);
        } else {
            mediaContainer.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; padding: 20px; text-align: center; border-radius: 18px;">
                    <img src="${initialThumb}" alt="preview" style="max-width: 80%; max-height: 50%; object-fit: cover; border-radius: 12px; margin-bottom: 16px;" />
                    <button type="button" onclick="window.openCurrentWatchCinema && window.openCurrentWatchCinema()" style="background: #0095f6; color: #fff; border: none; border-radius: 20px; padding: 10px 22px; font-weight: 700; font-size: 14px; cursor: pointer;">
                        ▶ Reproducir Video
                    </button>
                </div>
            `;
        }

        // Realistic stats
        const seed = Math.abs(String(item.id || '123').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
        const rawLikes = (seed * 123) % 95000 + 1200;
        const formattedLikes = rawLikes > 999 ? (rawLikes / 1000).toFixed(1) + ' mil' : rawLikes;
        const commentsCount = (seed % 650) + 24;
        const repostsCount = (seed % 880) + 50;
        const shareCount = (seed * 345) % 800000 + 10000 > 999 ? Math.floor(((seed * 345) % 800000 + 10000) / 1000) + ' mil' : '40.3 mil';

        const authorHandle = (item.author || 'creador').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'all18creator';
        const authorAvatar = item.author_avatar || getCreatorAvatar(item.author, item.id);

        const likeCountEl = document.getElementById('igLbLikeCount');
        const commentCountEl = document.getElementById('igLbCommentCount');
        const repostCountEl = document.getElementById('igLbRepostCount');
        const shareCountEl = document.getElementById('igLbShareCount');
        const authorNameEl = document.getElementById('igLbAuthorName');
        const authorImgEl = document.getElementById('igLbAuthorImg');
        const discImgEl = document.getElementById('igLbDiscImg');
        const captionEl = document.getElementById('igLbCaption');

        if (likeCountEl) likeCountEl.innerText = formattedLikes;
        if (commentCountEl) commentCountEl.innerText = commentsCount;
        if (repostCountEl) repostCountEl.innerText = repostsCount;
        if (shareCountEl) shareCountEl.innerText = shareCount;
        if (authorNameEl) authorNameEl.innerText = authorHandle;
        if (authorImgEl) authorImgEl.src = authorAvatar;
        if (discImgEl) discImgEl.src = authorAvatar;
        if (captionEl) captionEl.innerText = (item.title || '') + ' #fyp #viral #all18';

        // Like Button Event
        const likeBtn = document.getElementById('igLbLikeBtn');
        if (likeBtn) {
            const isFav = state.favorites.some(f => f.id === item.id);
            const svg = likeBtn.querySelector('svg');
            if (svg) svg.setAttribute('fill', isFav ? '#ff3040' : 'none');
            likeBtn.onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                const nowFav = state.favorites.some(f => f.id === item.id);
                if (svg) svg.setAttribute('fill', nowFav ? '#ff3040' : 'none');
                if (nowFav) AlgorithmEngine.recordEngagement(item, 'like');
            };
        }

        // Repost Button Event
        const repostBtn = document.getElementById('igLbRepostBtn');
        if (repostBtn) {
            repostBtn.onclick = (e) => {
                e.stopPropagation();
                showToast('🔁 Reel añadido a tu historia');
            };
        }

        // Comment Button Event
        const commentBtn = document.getElementById('igLbCommentBtn');
        if (commentBtn) {
            commentBtn.onclick = (e) => {
                e.stopPropagation();
                window.openCurrentWatchCinema('comments');
            };
        }

        // Share Button Event
        const shareBtn = document.getElementById('igLbShareBtn');
        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.stopPropagation();
                window.shareVideoItem(item);
            };
        }

        // Feedback: No me interesa
        const noInterestBtn = document.getElementById('igLbNoInterestBtn');
        if (noInterestBtn) {
            noInterestBtn.onclick = (e) => {
                e.stopPropagation();
                AlgorithmEngine.recordEngagement(item, 'skip_fast');
                showToast('✕ Mostraremos menos contenido como este');
                setTimeout(() => window.closeIgMediaModal(), 600);
            };
        }

        // Feedback: Me interesa
        const interestBtn = document.getElementById('igLbInterestBtn');
        if (interestBtn) {
            interestBtn.onclick = (e) => {
                e.stopPropagation();
                AlgorithmEngine.recordEngagement(item, 'like');
                showToast('✓ Preferencia guardada en tu algoritmo');
            };
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        try {
            history.pushState({ modal: 'igMediaModal' }, '');
        } catch(e) {}
    };

    window.closeIgMediaModal = function(popHistory = true) {
        const modal = document.getElementById('igMediaModal');
        const mediaContainer = document.getElementById('igLightboxMedia');
        if (modal) {
            if (mediaContainer) {
                const v = mediaContainer.querySelector('video');
                if (v) {
                    try { v.pause(); v.removeAttribute('src'); v.load(); } catch(e) {}
                }
                const ifr = mediaContainer.querySelector('iframe');
                if (ifr) {
                    try { ifr.src = 'about:blank'; } catch(e) {}
                }
                mediaContainer.innerHTML = '';
            }
            window.currentIgModalItem = null;
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';

            if (popHistory && history.state && history.state.modal === 'igMediaModal') {
                try { history.back(); } catch(e) {}
            }
        }
    };

    window.addEventListener('popstate', (e) => {
        const igModal = document.getElementById('igMediaModal');
        if (igModal && igModal.classList.contains('active')) {
            window.closeIgMediaModal(false);
        }
    });



    // Global TikTok Sound Controller
    window.isTikTokMuted = true;
    window.toggleTikTokSound = function(e, btn) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        window.isTikTokMuted = !window.isTikTokMuted;
        document.querySelectorAll('.feed-video-player').forEach(v => {
            v.muted = window.isTikTokMuted;
        });
        document.querySelectorAll('.tiktok-sound-icon').forEach(icon => {
            icon.textContent = window.isTikTokMuted ? '🔇' : '🔊';
        });
        document.querySelectorAll('.tiktok-btn-sound .tiktok-action-count').forEach(label => {
            label.textContent = window.isTikTokMuted ? 'Silencio' : 'Sonido';
        });
        if (typeof showToast === 'function') {
            showToast(window.isTikTokMuted ? '🔇 Audio silenciado' : '🔊 Audio activado');
        }
    };

    // ==========================================
    // GRID DENSITY CONTROLLER (1, 2, 3 COLUMNS)
    // ==========================================
    function setGridDensity(cols, showNotify = false) {
        const d = (cols === '1' || cols === '2' || cols === '3') ? cols : '2';
        try {
            localStorage.setItem('all18_grid_density', d);
        } catch (e) {}

        const grids = document.querySelectorAll('#mediaGrid, .media-grid, #hubVideoGrid, .hub-video-grid');
        grids.forEach(g => {
            g.classList.remove('grid-cols-1', 'grid-cols-2', 'grid-cols-3');
            g.classList.add(`grid-cols-${d}`);
        });

        document.querySelectorAll('.btn-grid-density').forEach(btn => {
            btn.setAttribute('data-density', d);
            btn.title = `Cuadrícula: ${d} ${d === '1' ? 'columna' : 'columnas'}`;
            const icon = btn.querySelector('.density-icon');
            if (icon) {
                icon.textContent = d === '1' ? '1️⃣' : (d === '2' ? '2️⃣' : '3️⃣');
            }
        });

        if (showNotify && typeof showToast === 'function') {
            showToast(`📱 Cuadrícula: ${d} ${d === '1' ? 'Columna' : 'Columnas'}`);
        }
    }
    window.setGridDensity = setGridDensity;

    function cycleGridDensity() {
        const cur = localStorage.getItem('all18_grid_density') || '2';
        const next = cur === '1' ? '2' : (cur === '2' ? '3' : '1');
        setGridDensity(next, true);
    }
    window.cycleGridDensity = cycleGridDensity;

    // Expose Global Theme Helpers on window
    window.state = state;
    window.loadVideos = function(page = 1, reset = false) {
        if (page) state.page = page;
        return fetchContent(reset);
    };
    window.loadMoreVideos = function() {
        state.page++;
        return fetchContent(false);
    };
    window.renderCards = renderCards;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
