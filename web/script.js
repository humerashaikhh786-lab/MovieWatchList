let selectedType = "movie";
let savedMovies = [];
let suggestionTimer = null;

const historyKey = "movieWatchListSearchHistory";
const countries = {
    US: "United States", IN: "India", GB: "United Kingdom", CA: "Canada",
    AU: "Australia", DE: "Germany", FR: "France", ES: "Spain", IT: "Italy",
    JP: "Japan", KR: "South Korea", CN: "China", BR: "Brazil", MX: "Mexico",
    AE: "United Arab Emirates", SA: "Saudi Arabia", SG: "Singapore",
    NZ: "New Zealand", RU: "Russia", TR: "Turkey", NL: "Netherlands"
};

const searchInput = document.getElementById("search");
const searchButton = document.getElementById("searchButton");
const movieContainer = document.getElementById("movieContainer");
const searchMessage = document.getElementById("searchMessage");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function posterUrl(path) {
    return path ? "https://image.tmdb.org/t/p/w500" + path : "";
}

function titleOf(item, type) {
    return type === "tv" ? (item.name || "Untitled") : (item.title || "Untitled");
}

function yearOf(item, type) {
    const date = type === "tv" ? item.first_air_date : item.release_date;
    return date ? date.substring(0, 4) : "N/A";
}

function getRegion(details, type) {
    if (type === "tv") {
        const origin = details.origin_country || [];
        if (origin.length) return origin.map(code => countries[code] || code).join(", ");
    }

    const production = details.production_countries || [];
    if (production.length) return production.map(c => c.name).join(", ");
    return "";
}

function buildTitleData(details, searchItem, type) {
    const title = titleOf(details, type) !== "Untitled"
        ? titleOf(details, type)
        : titleOf(searchItem, type);

    return {
        tmdbId: Number(details.id || searchItem.id || 0),
        title,
        type,
        year: yearOf(details, type) !== "N/A" ? yearOf(details, type) : yearOf(searchItem, type),
        genre: (details.genres || []).map(g => g.name).join(", ") || "Unknown",
        rating: Number(details.vote_average ?? searchItem.vote_average ?? 0),
        description: details.overview || searchItem.overview || "",
        poster: posterUrl(details.poster_path || searchItem.poster_path),
        region: getRegion(details, type),
        seasons: Number(details.number_of_seasons || 0),
        episodes: Number(details.number_of_episodes || 0)
    };
}

async function fetchDetails(id, type) {
    const response = await fetch(`/api/movie-details?id=${encodeURIComponent(id)}&type=${type}`);
    if (!response.ok) throw new Error("Details request failed");
    return await response.json();
}

function setSearchType(type) {
    selectedType = type;

    document.querySelectorAll(".type-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.searchType === type);
    });

    searchInput.placeholder = type === "tv"
        ? "Search for a TV show..."
        : "Search for a movie...";

    if (searchInput.value.trim()) performSearch(false);
}

document.querySelectorAll(".type-btn").forEach(btn => {
    btn.addEventListener("click", () => setSearchType(btn.dataset.searchType));
});

function createSuggestionBox(input, id) {
    const box = document.createElement("div");
    box.id = id;
    box.className = "suggestions-box hidden";
    input.parentElement.appendChild(box);
    return box;
}

const mainSuggestions = createSuggestionBox(searchInput, "mainSuggestions");

function showSuggestions(box, results, mixed = false) {
    if (!results.length) {
        box.classList.add("hidden");
        box.innerHTML = "";
        return;
    }

    const query = searchInput.value.trim().toLowerCase();
    const ordered = [...results].sort((a, b) => {
        const aType = mixed ? a.media_type : selectedType;
        const bType = mixed ? b.media_type : selectedType;
        const aTitle = titleOf(a, aType).toLowerCase();
        const bTitle = titleOf(b, bType).toLowerCase();
        const aExact = aTitle === query ? 0 : 1;
        const bExact = bTitle === query ? 0 : 1;
        return aExact - bExact;
    });

    box.innerHTML = ordered.slice(0, 7).map((item, index) => {
        const type = mixed ? item.media_type : selectedType;
        const title = titleOf(item, type);
        const year = yearOf(item, type);
        const exact = title.toLowerCase() === query;
        return `
            <button class="suggestion-item ${index === 0 || exact ? "best-match" : ""}" data-id="${item.id}" data-type="${type}">
                <span class="suggestion-poster">
                    ${item.poster_path
                        ? `<img src="${posterUrl(item.poster_path)}" alt="">`
                        : "✦"}
                </span>
                <span class="suggestion-info">
                    <strong>${escapeHtml(title)}</strong>
                    <small>${type === "tv" ? "TV Series" : "Movie"}${year !== "N/A" ? ` • ${escapeHtml(year)}` : ""}</small>
                </span>
                <span class="suggestion-arrow">›</span>
            </button>
        `;
    }).join("");

    box.classList.remove("hidden");

    box.querySelectorAll(".suggestion-item").forEach(button => {
        button.addEventListener("click", () => {
            const type = button.dataset.type;
            const title = button.querySelector("strong").textContent;
            searchInput.value = title;
            setSearchType(type);
            clearSearchButtonState();
            performSearch(true);
            box.classList.add("hidden");
        });
    });
}

async function getSuggestions(query, type) {
    const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=${type}`);
    if (!response.ok) throw new Error("Suggestion request failed");
    const data = await response.json();
    return (data.results || []).slice(0, 7);
}

async function updateMainSuggestions() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
        mainSuggestions.classList.add("hidden");
        return;
    }

    try {
        const results = await getSuggestions(query, selectedType);
        if (searchInput.value.trim() === query) showSuggestions(mainSuggestions, results);
    } catch (error) {
        console.error("Suggestion error:", error);
        mainSuggestions.classList.add("hidden");
    }
}

async function updateTopSuggestions() {
    // Kept as a no-op for compatibility with older cached scripts.
}

searchInput.addEventListener("input", () => {
    updateClearSearchButton();
    clearTimeout(suggestionTimer);
    updateClearSearchButton();
    suggestionTimer = setTimeout(updateMainSuggestions, 300);
});

searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        mainSuggestions.classList.add("hidden");
        performSearch(true);
    }
    if (event.key === "Escape") {
        mainSuggestions.classList.add("hidden");
    }
});

document.addEventListener("click", event => {
    if (!searchInput.parentElement.contains(event.target)) mainSuggestions.classList.add("hidden");
});

const clearSearchButton = document.getElementById("clearSearch");

function updateClearSearchButton() {
    if (!clearSearchButton) return;
    const hasText = searchInput.value.trim().length > 0;
    clearSearchButton.classList.toggle("hidden", !hasText);
    clearSearchButton.setAttribute("aria-hidden", String(!hasText));
}

function clearSearchButtonState() {
    updateClearSearchButton();
}

clearSearchButton?.addEventListener("click", () => {
    searchInput.value = "";
    mainSuggestions.classList.add("hidden");
    movieContainer.innerHTML = "";
    searchMessage.classList.remove("hidden");
    searchMessage.innerHTML = `
        <div class="empty-icon">✦</div>
        <h3>Nothing here yet</h3>
        <p>Search for a title to discover movies and TV shows.</p>
    `;
    updateClearSearchButton();
    searchInput.focus();
});

searchButton.addEventListener("click", () => {
    mainSuggestions.classList.add("hidden");
    performSearch(true);
});

async function performSearch(saveHistory) {
    const query = searchInput.value.trim();

    if (!query) {
        movieContainer.innerHTML = "";
        searchMessage.classList.remove("hidden");
        return;
    }

    if (saveHistory) saveSearch(query, selectedType);

    searchMessage.classList.add("hidden");
    movieContainer.innerHTML = `<div class="compact-empty">Searching the cinema database...</div>`;

    try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=${selectedType}`);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            movieContainer.innerHTML = "";
            searchMessage.classList.remove("hidden");
            searchMessage.innerHTML = `
                <div class="empty-icon">⌕</div>
                <h3>No results found</h3>
                <p>Try another title or check the spelling.</p>
            `;
            return;
        }

        renderSearchResults(data.results.slice(0, 12), selectedType);
    } catch (error) {
        console.error(error);
        movieContainer.innerHTML = `<div class="compact-empty">Could not complete the search right now.</div>`;
    }
}

async function renderSearchResults(results, type) {
    movieContainer.innerHTML = "";

    results.forEach(item => {
        const card = document.createElement("article");
        card.className = "poster-card";
        const title = titleOf(item, type);
        const year = yearOf(item, type);
        const rating = Number(item.vote_average || 0);
        const poster = posterUrl(item.poster_path);

        card.innerHTML = `
            <div class="poster-wrap poster-clickable" title="Open full details">
                ${poster ? `<img src="${poster}" alt="${escapeHtml(title)}" loading="lazy">` : `<div class="no-poster">✦</div>`}
                <span class="type-badge">${type === "tv" ? "TV Series" : "Movie"}</span>
            </div>
            <div class="poster-body">
                <h3>${escapeHtml(title)}</h3>
                <div class="meta">${escapeHtml(year)} • Loading genre...</div>
                <div class="rating">★ ${rating.toFixed(1)}/10</div>
                <div class="region">🌍 Loading region...</div>
                <div class="description">${escapeHtml(item.overview || "No description available.")}</div>
                <div class="card-actions four-actions">
                    <button class="watch-btn">▶ Watch</button>
                    <button class="list-btn">＋ To Watch</button>
                    <button class="watched-btn">✓ Already Watched</button>
                    <button class="favorite-btn">♡ Add to Favorites</button>
                </div>
            </div>
        `;

        movieContainer.appendChild(card);
        loadSearchCardDetails(card, item, type);
    });
}

async function loadSearchCardDetails(card, item, type) {
    const meta = card.querySelector(".meta");
    const region = card.querySelector(".region");
    let titleData;

    try {
        const details = await fetchDetails(item.id, type);
        const year = yearOf(details, type) !== "N/A" ? yearOf(details, type) : yearOf(item, type);
        const genres = (details.genres || []).map(g => g.name).join(", ") || "Genre unavailable";
        meta.textContent = `${year} • ${genres}`;
        region.textContent = `🌍 ${getRegion(details, type) || "Region unavailable"}`;
        titleData = buildTitleData(details, item, type);
    } catch (error) {
        console.error("Details error:", error);
        meta.textContent = `${yearOf(item, type)} • Genre unavailable`;
        region.textContent = "🌍 Region unavailable";
        titleData = buildTitleData(item, item, type);
    }

    updateSearchActionState(card, titleData);

    card.querySelector(".poster-wrap")?.addEventListener("click", () => openDetailPage(titleData));

    card.querySelector(".watch-btn").addEventListener("click", () => openWatchModal(titleData));
    card.querySelector(".list-btn").addEventListener("click", () => addToWatchlist(titleData, false, false));
    card.querySelector(".watched-btn").addEventListener("click", () => addToWatchlist(titleData, true, false));
    card.querySelector(".favorite-btn").addEventListener("click", () => addToWatchlist(titleData, false, true));
}

function findSavedByTmdb(titleData) {
    return savedMovies.find(item =>
        Number(item.tmdbId) === Number(titleData.tmdbId) && item.type === titleData.type
    );
}

function updateSearchActionState(card, titleData) {
    const saved = findSavedByTmdb(titleData);
    const listBtn = card.querySelector(".list-btn");
    const watchedBtn = card.querySelector(".watched-btn");
    const favoriteBtn = card.querySelector(".favorite-btn");

    listBtn.classList.toggle("action-active", Boolean(saved && !saved.watched));
    listBtn.textContent = saved && !saved.watched ? "✓ To Watch" : "＋ To Watch";
    watchedBtn.classList.toggle("action-active", Boolean(saved?.watched));
    watchedBtn.textContent = saved?.watched ? "✓ Watched" : "✓ Already Watched";
    favoriteBtn.classList.toggle("action-active", Boolean(saved?.favorite));
    favoriteBtn.textContent = saved?.favorite ? "♥ Favourite" : "♡ Add to Favorites";
}

async function addToWatchlist(titleData, watched = false, favorite = false) {
    const existing = findSavedByTmdb(titleData);
    const data = new URLSearchParams();

    data.append("title", titleData.title);
    data.append("genre", titleData.genre);
    data.append("year", titleData.year);
    data.append("rating", (titleData.rating / 2).toFixed(1));
    data.append("watched", String(existing ? existing.watched || watched : watched));
    data.append("favorite", String(existing ? existing.favorite || favorite : favorite));
    data.append("tmdbId", titleData.tmdbId);
    data.append("imageUrl", titleData.poster);
    data.append("description", titleData.description);
    data.append("type", titleData.type);
    data.append("region", titleData.region);
    data.append("seasons", titleData.seasons);
    data.append("episodes", titleData.episodes);

    try {
        const response = await fetch("/api/movies", { method: "POST", body: data });
        if (!response.ok) throw new Error("Add failed");
        await loadWatchlist();
        document.querySelectorAll(".poster-card").forEach(card => {
            const heading = card.querySelector("h3");
            if (heading && heading.textContent.trim() === titleData.title) {
                updateSearchActionState(card, titleData);
            }
        });
    } catch (error) {
        console.error(error);
        alert("Could not save this title.");
    }
}

async function performAction(id, action) {
    const data = new URLSearchParams();
    data.append("id", id);
    data.append("action", action);

    try {
        const response = await fetch("/api/movies/action", { method: "POST", body: data });
        if (!response.ok) throw new Error("Action failed");
        await loadWatchlist();
    } catch (error) {
        console.error(error);
        alert("Could not update this title.");
    }
}

async function loadWatchlist() {
    try {
        const response = await fetch("/api/movies");
        savedMovies = await response.json();
        renderWatchlist();
        loadStats();
    } catch (error) {
        console.error("Watchlist loading error:", error);
    }
}

function renderWatchlist() {
    const toWatchGrid = document.getElementById("toWatchGrid");
    const watchedGrid = document.getElementById("watchedGrid");
    const favoritesGrid = document.getElementById("favoritesGrid");

    toWatchGrid.innerHTML = "";
    watchedGrid.innerHTML = "";
    favoritesGrid.innerHTML = "";

    const toWatch = savedMovies.filter(item => !item.watched);
    const watched = savedMovies.filter(item => item.watched);
    const favorites = savedMovies.filter(item => item.favorite);

    toWatch.forEach(item => toWatchGrid.appendChild(createSavedCard(item)));
    watched.forEach(item => watchedGrid.appendChild(createSavedCard(item)));
    favorites.forEach(item => favoritesGrid.appendChild(createSavedCard(item)));

    document.getElementById("toWatchEmpty").classList.toggle("hidden", toWatch.length > 0);
    document.getElementById("watchedEmpty").classList.toggle("hidden", watched.length > 0);
    document.getElementById("favoritesEmpty").classList.toggle("hidden", favorites.length > 0);
}

function createSavedCard(item) {
    const card = document.createElement("article");
    card.className = "poster-card";
    const type = item.type === "tv" ? "TV Series" : "Movie";
    const tvMeta = item.type === "tv" && item.seasons
        ? `<div class="meta">${item.seasons} season${item.seasons === 1 ? "" : "s"} • ${item.episodes} episodes</div>`
        : "";

    card.innerHTML = `
        <div class="poster-wrap poster-clickable" title="Open full details">
            ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy">` : `<div class="no-poster">✦</div>`}
            <span class="type-badge">${type}</span>
            <button class="remove-card-btn" title="Remove from watchlist">×</button>
            ${item.favorite ? `<span class="favorite-badge">♥</span>` : ""}
        </div>
        <div class="poster-body">
            <h3>${escapeHtml(item.title)}</h3>
            <div class="meta">${escapeHtml(item.year)} • ${escapeHtml(item.genre)}</div>
            ${tvMeta}
            <div class="rating">★ ${Number(item.rating || 0).toFixed(1)}/5</div>
            <div class="region">🌍 ${escapeHtml(item.region || "Region unavailable")}</div>
            <div class="description">${escapeHtml(item.description || "No description available.")}</div>
            <div class="card-actions four-actions">
                <button class="watch-btn">▶ Watch</button>
                <button class="list-btn action-active">✓ To Watch</button>
                <button class="watched-btn ${item.watched ? "action-active" : ""}">✓ ${item.watched ? "Watched" : "Already Watched"}</button>
                <button class="favorite-btn ${item.favorite ? "action-active" : ""}">${item.favorite ? "♥ Favourite" : "♡ Add to Favorites"}</button>
            </div>
        </div>
    `;

    card.querySelector(".poster-wrap")?.addEventListener("click", () => openDetailPage({
        tmdbId: Number(item.tmdbId || 0),
        title: item.title,
        type: item.type,
        year: item.year,
        genre: item.genre,
        rating: Number(item.rating || 0) * 2,
        description: item.description,
        poster: item.imageUrl,
        region: item.region,
        seasons: item.seasons,
        episodes: item.episodes
    }));

    card.querySelector(".watch-btn").addEventListener("click", () => {
        if (!item.tmdbId) {
            alert("Watch-provider information is not available for this title.");
            return;
        }

        openWatchModal({
            tmdbId: item.tmdbId,
            title: item.title,
            type: item.type,
            year: item.year,
            genre: item.genre,
            rating: Number(item.rating || 0) * 2,
            description: item.description,
            poster: item.imageUrl,
            region: item.region
        });
    });

    card.querySelector(".list-btn").addEventListener("click", () => {
        alert("This title is already in your watchlist.");
    });

    card.querySelector(".watched-btn").addEventListener("click", () => {
        performAction(item.id, item.watched ? "unwatched" : "watched");
    });

    card.querySelector(".favorite-btn").addEventListener("click", () => {
        performAction(item.id, "favoriteToggle");
    });

    card.querySelector(".remove-card-btn").addEventListener("click", event => {
        event.stopPropagation();
        deleteTitle(item.id, item.title);
    });

    return card;
}

async function deleteTitle(id, title) {
    if (!confirm(`Remove "${title}" from your watchlist?`)) return;

    try {
        const response = await fetch(`/api/movies?id=${id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Delete failed");
        await loadWatchlist();
    } catch (error) {
        console.error(error);
        alert("Could not remove title.");
    }
}

async function loadStats() {
    try {
        const response = await fetch("/api/stats");
        const stats = await response.json();
        document.getElementById("totalMovies").textContent = stats.total;
        document.getElementById("watchedMovies").textContent = stats.watched;
        document.getElementById("unwatchedMovies").textContent = stats.unwatched;
        document.getElementById("averageRating").textContent = Number(stats.average || 0).toFixed(1);
    } catch (error) {
        console.error(error);
    }
}

/* =========================
   WATCH PROVIDERS
========================= */

async function openWatchModal(titleData) {
    const modal = document.getElementById("watchModal");
    const content = document.getElementById("watchContent");
    modal.classList.remove("hidden");

    content.innerHTML = `
        <div class="watch-header">
            ${titleData.poster
                ? `<img src="${escapeHtml(titleData.poster)}" alt="">`
                : `<div class="no-poster" style="width:78px;height:105px;border-radius:10px;">🎬</div>`}
            <div>
                <p class="eyebrow">WHERE TO WATCH</p>
                <h2>${escapeHtml(titleData.title)}</h2>
                <p>${escapeHtml(titleData.year)} • ${escapeHtml(titleData.genre || "")}</p>
                <p>Region: 🌍 ${escapeHtml(titleData.region || "Select your region below")}</p>
                <div class="info-links">
                    <a class="info-btn" href="https://www.google.com/search?q=${encodeURIComponent(titleData.title + " movie")}" target="_blank" rel="noopener noreferrer">⌕ Google Info</a>
                    <a class="info-btn" href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(titleData.title)}" target="_blank" rel="noopener noreferrer">ⓘ Wikipedia</a>
                </div>
            </div>
        </div>
        <div class="provider-group">
            <h3>Choose availability region</h3>
            <div class="inline-input">
                <select id="watchRegion">
                    ${Object.entries(countries).map(([code, name]) =>
                        `<option value="${code}" ${code === "IN" ? "selected" : ""}>${name} (${code})</option>`
                    ).join("")}
                </select>
                <button class="small-primary" id="checkProviders">Check</button>
            </div>
        </div>
        <div id="providerResults" class="provider-group">Checking legal viewing options...</div>
    `;

    document.getElementById("checkProviders").addEventListener("click", () => loadProviders(titleData));
    await loadProviders(titleData);
}

async function loadProviders(titleData) {
    const region = document.getElementById("watchRegion")?.value || "IN";
    const result = document.getElementById("providerResults");
    result.innerHTML = "Checking legal viewing options...";

    try {
        const response = await fetch(`/api/watch-providers?id=${encodeURIComponent(titleData.tmdbId)}&type=${titleData.type}&region=${region}`);
        const data = await response.json();
        const providers = data.results?.[region];

        if (!providers) {
            result.innerHTML = `<h3>Not currently available</h3><p class="provider-note">We couldn't find provider information for this title in ${escapeHtml(countries[region] || region)}.</p>`;
            return;
        }

        const freeProviders = uniqueProviders([...(providers.free || []), ...(providers.ads || [])]);
        const paidProviders = uniqueProviders([...(providers.flatrate || []), ...(providers.rent || []), ...(providers.buy || [])]);
        let html = "";

        if (freeProviders.length) {
            html += `<div class="provider-group free-box"><h3>🟢 Available free</h3><p class="provider-note">Free or ad-supported option according to the provider data.</p>${providerRows(freeProviders, null, "Watch Free", titleData.title)}</div>`;
        }

        if (paidProviders.length) {
            html += `<div class="provider-group paid-box"><h3>🔒 Paid access required</h3><p class="provider-note">A subscription, rental, or purchase may be required.</p>${providerRows(paidProviders, null, "Open", titleData.title)}</div>`;
        }

        result.innerHTML = html || `<h3>No provider listed</h3><p class="provider-note">There is currently no provider information for this region.</p>`;
    } catch (error) {
        console.error(error);
        result.innerHTML = `<h3>Could not check availability</h3><p class="provider-note">Please try again.</p>`;
    }
}

function uniqueProviders(list) {
    const seen = new Set();
    return list.filter(provider => {
        const key = provider.provider_id || provider.provider_name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function providerDestination(providerName, title) {
    const name = String(providerName || "").toLowerCase();
    const q = encodeURIComponent(title);

    if (name.includes("youtube")) return `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " official")}`;
    if (name.includes("netflix")) return `https://www.netflix.com/search?q=${q}`;
    if (name.includes("prime video") || name.includes("amazon prime")) return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`;
    if (name.includes("apple tv")) return `https://tv.apple.com/search?term=${q}`;
    if (name.includes("tubi")) return `https://tubitv.com/search/${q}`;
    if (name.includes("mx player")) return `https://www.mxplayer.in/`;
    if (name.includes("jiohotstar") || name.includes("hotstar")) return `https://www.hotstar.com/in/`;

    return "";
}

function providerRows(list, link, buttonText, title) {
    return list.map(provider => {
        const destination = providerDestination(provider.provider_name, title);
        const label = provider.provider_name?.toLowerCase().includes("youtube") && buttonText === "Watch Free"
            ? "Find on YouTube"
            : buttonText;

        return `
            <div class="provider-row">
                <div class="provider-name">
                    ${provider.logo_path ? `<img src="https://image.tmdb.org/t/p/w92${provider.logo_path}" alt="">` : `<span>▶</span>`}
                    <span>${escapeHtml(provider.provider_name)}</span>
                </div>
                ${destination
                    ? `<a class="provider-link" href="${escapeHtml(destination)}" target="_blank" rel="noopener noreferrer">${label}</a>`
                    : `<span class="provider-unavailable">Open provider</span>`}
            </div>
        `;
    }).join("");
}

document.getElementById("closeModal").addEventListener("click", closeModal);
document.querySelector(".modal-backdrop").addEventListener("click", closeModal);

function closeModal() {
    document.getElementById("watchModal").classList.add("hidden");
}

/* =========================
   FULL TITLE DETAILS
========================= */

async function openDetailPage(titleData) {
    const modal = document.getElementById("movieDetailModal");
    const content = document.getElementById("detailContent");
    if (!modal || !content) return;

    modal.classList.remove("hidden");
    document.body.classList.add("detail-open");
    content.innerHTML = `<div class="detail-loading"><div class="spinner"></div><h2>Loading details...</h2><p>Gathering cast, story and credits.</p></div>`;

    try {
        let details = titleData;
        if (titleData.tmdbId) {
            details = await fetchDetails(titleData.tmdbId, titleData.type);
        }
        renderDetailPage(details, titleData);
    } catch (error) {
        console.error("Full details error:", error);
        renderDetailPage(titleData, titleData);
    }
}

function renderDetailPage(details, fallback) {
    const type = fallback.type || (details.first_air_date ? "tv" : "movie");
    const title = titleOf(details, type) !== "Untitled" ? titleOf(details, type) : fallback.title;
    const poster = posterUrl(details.poster_path) || fallback.poster || "";
    const year = yearOf(details, type) !== "N/A" ? yearOf(details, type) : fallback.year;
    const genres = (details.genres || []).map(g => g.name).join(", ") || fallback.genre || "Genre unavailable";
    const region = getRegion(details, type) || fallback.region || "Region unavailable";
    const rating = Number(details.vote_average ?? fallback.rating ?? 0);
    const runtime = details.runtime ? `${details.runtime} min` : details.episode_run_time?.[0] ? `${details.episode_run_time[0]} min/episode` : "";
    const cast = details.credits?.cast || [];

    document.getElementById("detailContent").innerHTML = `
        <div class="detail-layout">
            <aside class="detail-poster-column">
                <div class="detail-poster">
                    ${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}">` : `<div class="no-poster">✦</div>`}
                </div>
                <button class="detail-watch-btn" id="detailWatchBtn">▶ Where to Watch</button>
                <div class="detail-info-actions">
                    <a class="info-btn large" href="https://www.google.com/search?q=${encodeURIComponent(title + " movie")}" target="_blank" rel="noopener noreferrer">⌕ Google</a>
                    <a class="info-btn large" href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}" target="_blank" rel="noopener noreferrer">ⓘ Wikipedia</a>
                </div>
            </aside>

            <section class="detail-main">
                <p class="eyebrow">${type === "tv" ? "TV SHOW" : "MOVIE"} • ${escapeHtml(String(year))}</p>
                <h1>${escapeHtml(title)}</h1>
                <div class="detail-meta-line">
                    <span>★ ${rating.toFixed(1)}/10</span>
                    <span>${escapeHtml(genres)}</span>
                    ${runtime ? `<span>${escapeHtml(runtime)}</span>` : ""}
                    <span>🌍 ${escapeHtml(region)}</span>
                </div>
                ${type === "tv" && details.number_of_seasons ? `<div class="detail-tv-stats"><strong>${details.number_of_seasons}</strong> seasons <strong>${details.number_of_episodes || 0}</strong> episodes</div>` : ""}
                <div class="detail-section">
                    <h2>About</h2>
                    <p>${escapeHtml(details.overview || fallback.description || "No description available.")}</p>
                </div>

                <div class="detail-section">
                    <div class="detail-section-head"><h2>Cast</h2><span>${cast.length ? `${Math.min(cast.length, 12)} featured actors` : "Cast unavailable"}</span></div>
                    <div class="cast-grid">
                        ${cast.slice(0, 12).map(actor => `
                            <article class="actor-card" data-person-id="${actor.id}">
                                <div class="actor-photo">
                                    ${actor.profile_path ? `<img src="https://image.tmdb.org/t/p/w185${actor.profile_path}" alt="${escapeHtml(actor.name || "Actor")}" loading="lazy">` : `<span>👤</span>`}
                                </div>
                                <div class="actor-body">
                                    <strong>${escapeHtml(actor.name || "Unknown actor")}</strong>
                                    <small>${escapeHtml(actor.character || "Cast")}</small>
                                    <button class="actor-works-btn" type="button">View their work</button>
                                </div>
                                <div class="actor-works hidden"></div>
                            </article>
                        `).join("") || `<div class="compact-empty">Cast information is not available.</div>`}
                    </div>
                </div>
            </section>
        </div>
    `;

    document.getElementById("detailWatchBtn")?.addEventListener("click", () => {
        closeDetailPage();
        openWatchModal({
            tmdbId: Number(details.id || fallback.tmdbId || 0),
            title, type, year, genre: genres, rating, description: details.overview || fallback.description,
            poster, region, seasons: details.number_of_seasons || 0, episodes: details.number_of_episodes || 0
        });
    });

    document.querySelectorAll(".actor-works-btn").forEach(button => {
        button.addEventListener("click", () => {
            const card = button.closest(".actor-card");
            loadActorWorks(Number(card.dataset.personId), card.querySelector(".actor-works"), button);
        });
    });
}

async function loadActorWorks(personId, panel, button) {
    if (!personId || !panel) return;
    if (!panel.classList.contains("hidden")) {
        panel.classList.add("hidden");
        button.textContent = "View their work";
        return;
    }

    panel.classList.remove("hidden");
    button.textContent = "Loading work...";
    panel.innerHTML = `<div class="actor-work-loading">Loading their filmography...</div>`;

    try {
        const response = await fetch(`/api/person-details?id=${encodeURIComponent(personId)}`);
        if (!response.ok) throw new Error("Actor details failed");
        const data = await response.json();
        const works = (data.combined_credits?.cast || [])
            .filter(work => work && (work.title || work.name))
            .sort((a, b) => Number(b.vote_count || 0) - Number(a.vote_count || 0))
            .slice(0, 8);

        panel.innerHTML = works.length ? `
            <div class="actor-works-title">More work</div>
            <div class="actor-work-grid">
                ${works.map(work => {
                    const workType = work.media_type || (work.first_air_date ? "tv" : "movie");
                    const workTitle = titleOf(work, workType);
                    const workYear = yearOf(work, workType);
                    return `<div class="actor-work-item">
                        ${work.poster_path ? `<img src="${posterUrl(work.poster_path)}" alt="" loading="lazy">` : `<div class="actor-work-no-poster">✦</div>`}
                        <div><strong>${escapeHtml(workTitle)}</strong><small>${escapeHtml(workYear)} • ★ ${Number(work.vote_average || 0).toFixed(1)}</small></div>
                    </div>`;
                }).join("")}
            </div>
        ` : `<div class="actor-work-loading">No additional credited work found.</div>`;
        button.textContent = "Hide their work";
    } catch (error) {
        console.error("Actor work error:", error);
        panel.innerHTML = `<div class="actor-work-loading">Could not load this actor's work.</div>`;
        button.textContent = "Try again";
    }
}

document.getElementById("closeDetail")?.addEventListener("click", closeDetailPage);
document.querySelector(".detail-backdrop")?.addEventListener("click", closeDetailPage);

function closeDetailPage() {
    document.getElementById("movieDetailModal")?.classList.add("hidden");
    document.body.classList.remove("detail-open");
}

/* =========================
   SEARCH HISTORY
========================= */

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(historyKey) || "[]");
    } catch {
        return [];
    }
}

function saveSearch(query, type) {
    let history = getHistory();
    history = history.filter(item => !(item.query.toLowerCase() === query.toLowerCase() && item.type === type));
    history.unshift({ query, type, date: Date.now() });
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 15)));
    renderHistory();
}

function deleteHistoryItem(index) {
    const history = getHistory();
    history.splice(index, 1);
    localStorage.setItem(historyKey, JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const wrap = document.getElementById("searchHistory");
    const list = document.getElementById("historyList");
    const history = getHistory();

    if (!history.length) {
        wrap.classList.add("hidden");
        list.innerHTML = "";
        return;
    }

    wrap.classList.remove("hidden");
    list.innerHTML = history.map((item, index) => `
        <div class="history-item">
            <button class="history-open" data-history-index="${index}">
                <span>${item.type === "tv" ? "📺" : "🎬"}</span>
                <span>${escapeHtml(item.query)}</span>
            </button>
            <button class="history-delete" data-history-delete="${index}" title="Delete this search">×</button>
        </div>
    `).join("");

    list.querySelectorAll(".history-open").forEach(button => {
        button.addEventListener("click", () => {
            const item = history[Number(button.dataset.historyIndex)];
            setSearchType(item.type);
            searchInput.value = item.query;
            performSearch(false);
        });
    });

    list.querySelectorAll(".history-delete").forEach(button => {
        button.addEventListener("click", () => deleteHistoryItem(Number(button.dataset.historyDelete)));
    });
}

document.getElementById("clearHistory").addEventListener("click", () => {
    localStorage.removeItem(historyKey);
    renderHistory();
});

renderHistory();
updateClearSearchButton();
loadWatchlist();

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeDetailPage();
        closeModal();
    }
});
