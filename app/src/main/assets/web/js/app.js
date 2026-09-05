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
        try { initTheme(); } catch (e) { console.error('initTheme error:', e); }
        try { setupEventListeners(); } catch (e) { console.error('setupEventListeners error:', e); }
        try { setupPublishEngine(); } catch (e) { console.error('setupPublishEngine error:', e); }
        try { checkAgeGate(); } catch (e) { console.error('checkAgeGate error:', e); }
        try { updateFavoritesBadge(); } catch (e) { console.error('updateFavoritesBadge error:', e); }
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
            state.page = Math.floor(Math.random() * 20) + 1;
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

            if (videoId) {
                let directItem = null;
                if (videoId.startsWith('ph_')) {
                    const rawId = videoId.replace('ph_', '');
                    directItem = { id: videoId, raw_id: rawId, title: 'Video All18', source: 'Pornhub', embed_url: 'https://www.pornhub.com/embed/' + rawId, author: '@PornhubStar', views: '240K vistas', rating: '96%', category: 'Latina' };
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
                        let mp4 = '';
                        if (g.urls?.hd && g.urls.hd.includes('.mp4')) mp4 = g.urls.hd;
                        else if (g.urls?.sd && g.urls.sd.includes('.mp4')) mp4 = g.urls.sd;
                        else if (g.urls?.silent && g.urls.silent.includes('.mp4')) mp4 = g.urls.silent;

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
                            embed_url: `https://www.redgifs.com/ifr/${g.id}?autoplay=1`,
                            source: 'RedGifs',
                            tags: g.tags || ['shorts', 'hot'],
                            type: 'short',
                            quality: '4K Ultra'
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
    // ALL18 TIKTOK INTELLIGENT RECOMMENDATION & FYP ALGORITHM ENGINE (v1.0)
    // =========================================================================
    const AlgorithmEngine = {
        STORAGE_KEY: 'all18_algorithm_profile_v1',
        SEEN_STORAGE_KEY: 'all18_seen_history_v1',
        
        CATEGORY_POOL: [
            'latina', 'amateur', 'casero', 'modelos', 'milf', 'culos',
            'tetas', 'cosplay', 'jovencitas', 'mamadas', 'creampie',
            'anal', 'lesbiana', 'pov', 'trios', 'hardcore', 'hot', 'viral', 'dance'
        ],

        getProfile() {
            try {
                const raw = localStorage.getItem(this.STORAGE_KEY);
                if (raw) return JSON.parse(raw);
            } catch (e) {}
            return {
                tagScores: { 'latina': 10, 'amateur': 8, 'hot': 6, 'viral': 4 },
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
            if (arr.length > 250) arr.splice(0, arr.length - 250);
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
            if (tags.size === 0) tags.add('trending');
            return Array.from(tags);
        },

        recordEngagement(item, action, metadata = {}) {
            if (!item) return;
            const profile = this.getProfile();
            const tags = this.extractTags(item);
            const author = item.author ? item.author.toLowerCase().replace('@', '') : null;

            let weight = 0;
            switch (action) {
                case 'like': weight = 6; break;
                case 'favorite': weight = 9; break;
                case 'share': weight = 7; break;
                case 'follow': weight = 12; break;
                case 'loop': weight = 5; break;
                case 'watch_complete': weight = 4; break;
                case 'watch_good': weight = 3; break;
                case 'skip_fast': weight = -2; break;
                case 'not_interested': weight = -10; break;
            }

            // Update tag scores with decay bounding
            tags.forEach(t => {
                profile.tagScores[t] = (profile.tagScores[t] || 0) + weight;
                if (profile.tagScores[t] < -12) profile.tagScores[t] = -12;
                if (profile.tagScores[t] > 100) profile.tagScores[t] = 100;
            });

            // Update creator score
            if (author && weight > 0) {
                profile.creatorScores[author] = (profile.creatorScores[author] || 0) + (weight * 0.8);
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

        scoreAndDiversifyFeed(items) {
            const profile = this.getProfile();
            const seen = this.getSeenIds();

            // 1. Filter out already seen videos in current session
            let candidates = items.filter(item => !seen.has(item.id));
            if (candidates.length < 3) candidates = items;

            // 2. Score candidates with multi-factor weighting
            const scored = candidates.map(item => {
                const tags = this.extractTags(item);
                const author = item.author ? item.author.toLowerCase().replace('@', '') : null;

                let tagAffinity = 0;
                tags.forEach(t => {
                    tagAffinity += (profile.tagScores[t] || 0);
                });

                const creatorAffinity = author && profile.creatorScores[author] ? profile.creatorScores[author] : 0;
                const rawViews = parseInt(item.views) || 5000;
                const viewsBonus = Math.min(rawViews / 20000, 4);
                const explorationJitter = (Math.random() * 6) - 1.5;

                const totalScore = (tagAffinity * 0.45) + (creatorAffinity * 0.35) + viewsBonus + explorationJitter;

                let badge = '#ParaTi';
                if (tagAffinity > 18) badge = `#ParaTi 🔥 (${tags[0] || 'Top'})`;
                else if (creatorAffinity > 10) badge = `#CreadorFavorito ⭐`;
                else if (viewsBonus > 2.5) badge = `#Tendencia ⚡`;

                return {
                    ...item,
                    _score: totalScore,
                    _primaryTag: tags[0] || 'general',
                    recommendationBadge: badge
                };
            });

            // 3. Sort by algorithmic ranking
            scored.sort((a, b) => b._score - a._score);

            // 4. Interleaving shuffle for category and creator diversity
            const diversified = [];
            let lastTag = '';
            const remaining = [...scored];

            while (remaining.length > 0) {
                let nextIdx = remaining.findIndex(i => i._primaryTag !== lastTag);
                if (nextIdx === -1) nextIdx = 0;
                const chosen = remaining.splice(nextIdx, 1)[0];
                diversified.push(chosen);
                lastTag = chosen._primaryTag;
                this.markSeen(chosen.id);
            }

            return diversified;
        },

        resetAlgorithm() {
            localStorage.removeItem(this.STORAGE_KEY);
            sessionStorage.removeItem(this.SEEN_STORAGE_KEY);
            showToast('✨ Algoritmo Para Ti reiniciado');
        }
    };
    window.AlgorithmEngine = AlgorithmEngine;

    async function fetchContent(reset = false) {
        if (state.view === 'favorites') {
            renderFavorites();
            return;
        }

        const currentSession = ++state.searchSessionId;
        state.loading = true;

        const grid = elements.grid || document.getElementById('mediaGrid');
        const countBadge = elements.itemCount || document.getElementById('itemCount');
        const loadMoreBtn = elements.loadMoreBtn || document.getElementById('btnLoadMore');

        if (reset) {
            state.page = 1;
            state.items = [];
            if (grid) grid.innerHTML = getSkeletonHTML(12);
            if (countBadge) countBadge.textContent = '(cargando...)';
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

        let hasClearedSkeletons = !reset;

        function appendProgressiveItems(items) {
            if (state.searchSessionId !== currentSession) return;
            if (!items || items.length === 0) return;

            const targetGrid = elements.grid || document.getElementById('mediaGrid');
            if (!targetGrid) return;

            const existingIds = new Set(state.items.map(i => i.id));
            const uniqueItems = items.filter(i => !existingIds.has(i.id));
            if (uniqueItems.length === 0) return;

            if (!hasClearedSkeletons) {
                targetGrid.innerHTML = '';
                hasClearedSkeletons = true;
            }

            state.items.push(...uniqueItems);
            renderCards(uniqueItems);

            const badge = elements.itemCount || document.getElementById('itemCount');
            if (badge) {
                badge.textContent = `(${state.items.length}+ videos)`;
            }
        }

        const providerTasks = [];

        const isTikTokMode = document.body.dataset.theme === 'tiktok' || state.view === 'shorts';

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

                // Standard fallback / manual search in TikTok mode
                const direct = await fetchDirectRedGifs(q || cat || 'trending', page);
                if (direct && direct.length > 0) {
                    const ranked = isTikTokMode ? AlgorithmEngine.scoreAndDiversifyFeed(direct) : direct;
                    appendProgressiveItems(ranked);
                } else {
                    const res = await fetch(`api.php?action=search&source=redgifs&q=${encodeURIComponent(q || 'trending')}&category=${encodeURIComponent(cat)}&page=${page}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.data) {
                            const ranked = isTikTokMode ? AlgorithmEngine.scoreAndDiversifyFeed(data.data) : data.data;
                            appendProgressiveItems(ranked);
                        }
                    }
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
        }

        await Promise.allSettled(providerTasks);

        if (state.searchSessionId !== currentSession) return;
        state.loading = false;

        const targetGrid = elements.grid || document.getElementById('mediaGrid');
        const btnLoad = elements.loadMoreBtn || document.getElementById('btnLoadMore');

        if (!hasClearedSkeletons && targetGrid) {
            targetGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                    <h3 style="font-size: 20px; margin-bottom: 8px;">No se encontraron resultados</h3>
                    <p style="color: var(--text-dim);">Prueba con otra categoría o búsqueda.</p>
                </div>
            `;
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
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
    ];

    function getCreatorAvatar(author, rawId) {
        if (!author) return CREATOR_AVATARS[0];
        const hash = Math.abs(String(author + (rawId || '')).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
        return CREATOR_AVATARS[hash % CREATOR_AVATARS.length];
    }

    const FALLBACK_THUMB = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%230e0e12'/%3E%3Ccircle cx='320' cy='170' r='42' fill='%231a1a22' stroke='%232a2a36' stroke-width='2'/%3E%3Cpolygon points='314,154 334,170 314,186' fill='%23ff9000'/%3E%3Ctext x='320' y='245' font-family='-apple-system,BlinkMacSystemFont,sans-serif' font-size='22' font-weight='900' fill='%23ff9000' text-anchor='middle'%3EALL18%3C/text%3E%3Ctext x='320' y='270' font-family='-apple-system,BlinkMacSystemFont,sans-serif' font-size='13' font-weight='600' fill='%23666677' text-anchor='middle'%3EVideo Exclusivo%3C/text%3E%3C/svg%3E";
    window.FALLBACK_THUMB = FALLBACK_THUMB;

    function createVideoCard(item, index = 10) {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.dataset.id = item.id;

        const isFav = state.favorites.some(f => f.id === item.id);
        const isUserPost = !!item.is_user_post;
        const initialThumb = item.thumb || FALLBACK_THUMB;
        const mediaVideoUrl = item.media_url || (isUserPost && item.video_url ? item.video_url : '');

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
                        <span class="x-more-btn" title="Más opciones">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
                        </span>
                    </div>
                    <p class="x-post-text">
                        ${escapeHTML(item.title || '').replace(/(#[a-zA-Z0-9_]+)/g, '<span class="x-hashtag">$1</span>').replace(/(@[a-zA-Z0-9_]+)/g, '<span class="x-mention">$1</span>')}
                    </p>
                    <div class="thumb-container">
                        <img class="thumb-img" src="${initialThumb}" alt="${escapeHTML(item.title || 'Video')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.classList.add('loaded')" onerror="this.onerror=null; this.src=window.FALLBACK_THUMB||''; this.classList.add('loaded');"/>
                        ${mediaVideoUrl ? `<video class="feed-video-player" referrerpolicy="no-referrer" loop playsinline muted preload="none" data-src="${mediaVideoUrl}" poster="${initialThumb}"></video>` : ''}
                        <span class="duration-badge">${item.duration || '0:34'}</span>
                        <div class="x-center-play">
                            <svg viewBox="0 0 24 24" width="32" height="32" fill="#ffffff"><path d="M8 5v14l11-7z"/></svg>
                        </div>
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
                <div class="thumb-container">
                    <img class="thumb-img" src="${initialThumb}" alt="${escapeHTML(item.title || 'Video')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.classList.add('loaded')" onerror="this.onerror=null; this.src=window.FALLBACK_THUMB||''; this.classList.add('loaded');"/>
                    ${mediaVideoUrl ? `<video class="feed-video-player" referrerpolicy="no-referrer" loop playsinline muted preload="none" data-src="${mediaVideoUrl}" poster="${initialThumb}"></video>` : ''}
                    <span class="duration-badge">${item.duration || '18:50'}</span>
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
            if (e.target.closest('.x-action-item') || e.target.closest('.card-fav-btn') || e.target.closest('.x-more-btn') || e.target.closest('.tiktok-action-item') || e.target.closest('.ig-action-item') || e.target.closest('.ig-post-more-btn') || e.target.closest('.ig-media-mute-btn')) {
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
                window.location.href = 'watch.html?v=' + encodeURIComponent(item.id);
            } else {
                openWatchView(item);
            }
        });

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
                            v.muted = true;
                            v.defaultMuted = true;
                            v.play().then(() => {
                                targetCard.classList.add('video-playing');
                            }).catch(() => {});
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
    }

    function openWatchView(item, pushHistory = true) {
        state.activeModalItem = item;
        try { try { localStorage.setItem('all18_current_watch', JSON.stringify(item)); } catch(e){}; sessionStorage.setItem('all18_current_watch', JSON.stringify(item)); } catch (e) {}
        const catalogView = document.getElementById('catalogView');
        const watchView = document.getElementById('watchView');
        
        // If watchView is missing (e.g. on index.html standalone), redirect to watch.html
        if (!watchView) {
            window.location.href = `watch.html?v=${item.id}`;
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
            avatarEl.src = item.author_avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`;
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

            if (item.source === 'RedGifs' || item.type === 'short') {
                const ifrUrl = item.embed_url || `https://www.redgifs.com/ifr/${item.raw_id}?autoplay=1`;
                if (item.media_url) {
                    playerWrapper.innerHTML = `
                        <video src="${item.media_url}" controls autoplay loop playsinline referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:contain;background:#000;"></video>
                    `;
                } else {
                    playerWrapper.innerHTML = `
                        <iframe src="${ifrUrl}" frameborder="0" width="100%" height="100%" scrolling="no" allowfullscreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" referrerpolicy="no-referrer"></iframe>
                    `;
                }
            } else if (item.embed_url) {
                playerWrapper.innerHTML = `
                    <iframe src="${item.embed_url}" frameborder="0" width="100%" height="100%" scrolling="no" allowfullscreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" referrerpolicy="no-referrer"></iframe>
                `;
            } else if (item.media_url) {
                playerWrapper.innerHTML = `
                    <video src="${item.media_url}" controls autoplay playsinline referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:contain;background:#000;"></video>
                `;
            } else {
                playerWrapper.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;min-height:300px;">
                        <p>Reproductor no disponible para este enlace.</p>
                    </div>
                `;
            }
        }

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
            myAvatarEl.src = userProfile.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80';
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
    const DEFAULT_SAMPLE_COMMENTS = [
        { id: 'c1', user_name: 'CarlosM', user_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80', text: '¡Increíble video! La calidad es una locura 🔥🔥🔥', created_at: 'Hace 2 horas' },
        { id: 'c2', user_name: '@DiablaHot', user_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80', text: 'Me encantó la escena del minuto 03:20 💦💦', created_at: 'Hace 5 horas' },
        { id: 'c3', user_name: 'LatinLover', user_avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&auto=format&fit=crop&q=80', text: 'Excelente contenido, suban más de esta modelo por favor ⭐👑', created_at: 'Ayer' }
    ];

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
                // fallback to local/sample
            }
        }

        if (comments.length === 0) {
            comments = DEFAULT_SAMPLE_COMMENTS;
        }

        if (badgeEl) badgeEl.textContent = `(${comments.length})`;

        comments.forEach(c => {
            const itemEl = document.createElement('div');
            itemEl.className = 'comment-card-item';
            itemEl.innerHTML = `
                <img src="${c.user_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'}" alt="Avatar" class="comment-item-avatar">
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
            user_avatar: userProfile.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80',
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
        const authorAvatar = state.activeModalItem ? state.activeModalItem.author_avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';

        const nameEl = document.getElementById('creatorHeadName');
        const handleEl = document.getElementById('creatorHeadHandle');
        const avatarEl = document.getElementById('creatorHeadAvatar');
        const bioEl = document.getElementById('creatorHeadBio');
        const gridEl = document.getElementById('creatorVideosGrid');

        if (nameEl) nameEl.textContent = authorName;
        if (handleEl) handleEl.textContent = authorName.startsWith('@') ? authorName : '@' + authorName.replace(/\s+/g, '');
        if (avatarEl) avatarEl.src = authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';
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

    window.backToCatalog = function (pushHistory = true) { if (window.location.pathname.includes('watch.html') || window.location.pathname.includes('watch.php') || document.body.classList.contains('watch-page-body')) { window.location.href = 'index.html'; return; }
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

    window.shareCurrentVideo = function () {
        if (state.activeModalItem) {
            const shareUrl = window.location.origin + window.location.pathname + '?v=' + state.activeModalItem.id;
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast('🔗 ¡Enlace del video copiado al portapapeles!');
            }).catch(() => {
                showToast('URL: ' + shareUrl);
            });
        }
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
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        bio: 'Creador y miembro de la comunidad All18.',
        is_anonymous: false,
        is_onboarded: false
    };

    const ANONYMOUS_AVATARS = [ "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23000'/%3E%3Ctext x='50' y='55' font-family='Arial' font-size='28' font-weight='bold' fill='%23ff9000' text-anchor='middle' alignment-baseline='middle'%3EALL18%3C/text%3E%3C/svg%3E", 
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=150&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80'
    ];

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
            if (userAvatar) userAvatar.src = profile.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
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
            twitter: 'X / Twitter Timeline'
        };

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
            let thumb = state.generatedThumbnail || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80';
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
        const dispAvatar = userProfile.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';

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
    window.openXMediaModal = function(item) {
        const modal = document.getElementById('xMediaModal');
        const mediaContainer = document.getElementById('xLightboxMedia');
        if (!modal || !mediaContainer) return;

        const isUserPost = !!item.is_user_post;
        const mediaVideoUrl = item.media_url || (isUserPost && item.video_url ? item.video_url : '');
        const initialThumb = item.thumb || FALLBACK_THUMB;

        if (mediaVideoUrl) {
            mediaContainer.innerHTML = `
                <video src="${mediaVideoUrl}" poster="${initialThumb}" autoplay loop playsinline controls style="max-width: 100%; max-height: 100%; object-fit: contain; width: 100%;"></video>
            `;
        } else {
            mediaContainer.innerHTML = `
                <img src="${initialThumb}" alt="${escapeHTML(item.title || 'Media')}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
            `;
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
            likeBtn.style.color = isFav ? '#f91880' : '#ffffff';
            likeBtn.onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                const nowFav = state.favorites.some(f => f.id === item.id);
                likeBtn.style.color = nowFav ? '#f91880' : '#ffffff';
            };
        }

        const repostBtn = document.getElementById('xLbRepostBtn');
        if (repostBtn) {
            repostBtn.onclick = (e) => {
                e.stopPropagation();
                repostBtn.style.color = repostBtn.style.color === 'rgb(0, 186, 124)' ? '#ffffff' : '#00ba7c';
                showToast('🔁 Reposteado');
            };
        }

        const replyBtn = document.getElementById('xLbReplyBtn');
        if (replyBtn) {
            replyBtn.onclick = (e) => {
                e.stopPropagation();
                showToast('💬 Respuestas abiertas');
            };
        }

        const shareBtn = document.getElementById('xLbShareBtn');
        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.stopPropagation();
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                    showToast('🔗 Enlace copiado');
                }
            };
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.closeXMediaModal = function() {
        const modal = document.getElementById('xMediaModal');
        const mediaContainer = document.getElementById('xLightboxMedia');
        if (modal) {
            if (mediaContainer) {
                const v = mediaContainer.querySelector('video');
                if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
                mediaContainer.innerHTML = '';
            }
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    // =========================================================================
    // INSTAGRAM 1:1 FULLSCREEN REELS / PLAYER VIEWER
    // =========================================================================
    window.openIgMediaModal = function(item) {
        const modal = document.getElementById('igMediaModal');
        const mediaContainer = document.getElementById('igLightboxMedia');
        if (!modal || !mediaContainer) return;

        const isUserPost = !!item.is_user_post;
        const mediaVideoUrl = item.media_url || (isUserPost && item.video_url ? item.video_url : '');
        const initialThumb = item.thumb || FALLBACK_THUMB;

        if (mediaVideoUrl) {
            mediaContainer.innerHTML = `
                <video src="${mediaVideoUrl}" poster="${initialThumb}" autoplay loop playsinline controls style="width: 100%; height: 100%; object-fit: cover;"></video>
            `;
        } else {
            mediaContainer.innerHTML = `
                <img src="${initialThumb}" alt="${escapeHTML(item.title || 'Media')}" style="width: 100%; height: 100%; object-fit: cover;" />
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
                showToast('💬 Comentarios del Reel');
            };
        }

        // Share Button Event
        const shareBtn = document.getElementById('igLbShareBtn');
        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.stopPropagation();
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                    showToast('🔗 Enlace de Reel copiado');
                }
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
    };

    window.closeIgMediaModal = function() {
        const modal = document.getElementById('igMediaModal');
        const mediaContainer = document.getElementById('igLightboxMedia');
        if (modal) {
            if (mediaContainer) {
                const v = mediaContainer.querySelector('video');
                if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
                mediaContainer.innerHTML = '';
            }
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    };



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
