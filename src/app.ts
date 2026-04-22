import { fetchWeather, searchPlaces, tryParseLatLon, windCompass, type GeoResult } from "./api";

const STORAGE_KEY = "weather_last_query_v1";
/** How often to pull fresh data from the API while a location is open */
const LIVE_REFRESH_MS = 10 * 60 * 1000;

type LivePin = {
  lat: number;
  lon: number;
  country: string;
  label: string;
};

let liveRefreshTimer: ReturnType<typeof setInterval> | null = null;

function clearLiveRefresh(): void {
  if (liveRefreshTimer) {
    clearInterval(liveRefreshTimer);
    liveRefreshTimer = null;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function skyMood(code: number): "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm" | "default" {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 95) return "storm";
  return "default";
}

function iconForCode(code: number): string {
  if (code === 0 || code === 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

export function mount(root: HTMLElement): void {
  clearLiveRefresh();
  root.innerHTML = "";
  root.className = "shell";

  const layout = el("div", "layout");
  root.appendChild(layout);

  const header = el("header", "header");
  const titleRow = el("div", "title-row");
  titleRow.appendChild(el("span", "title-badge", "✦"));
  const h1 = el("h1", "title");
  h1.innerHTML = `<span class="title-gradient">Skyline</span>`;
  titleRow.appendChild(h1);
  header.appendChild(titleRow);
  header.appendChild(
    el(
      "p",
      "subtitle",
      "Search uses Open-Meteo plus OpenStreetMap (Photon) so more villages resolve. If your village spelling differs from the map, try the nearest block town or paste latitude, longitude from Google Maps."
    )
  );
  layout.appendChild(header);

  const searchRow = el("div", "search-row");
  const input = el("input", "search-input") as HTMLInputElement;
  input.type = "search";
  input.placeholder = "Village, city, district… or lat, lon (e.g. 24.5376, 87.8996)";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "City search");
  const btn = el("button", "btn primary", "Search") as HTMLButtonElement;
  btn.type = "button";
  searchRow.appendChild(input);
  searchRow.appendChild(btn);
  layout.appendChild(searchRow);

  const suggestions = el("ul", "suggestions hidden");
  suggestions.setAttribute("role", "listbox");
  layout.appendChild(suggestions);

  const status = el("p", "status muted", "");
  layout.appendChild(status);

  const panel = el("main", "panel hidden");
  layout.appendChild(panel);

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) input.value = saved;

  let debounce: ReturnType<typeof setTimeout> | null = null;
  let activeResults: GeoResult[] = [];
  let lastPin: LivePin | null = null;

  function setStatus(msg: string, kind: "muted" | "err" = "muted"): void {
    status.textContent = msg;
    status.className = `status ${kind === "err" ? "status-err" : "muted"}`;
  }

  function hideSuggestions(): void {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
    activeResults = [];
  }

  function showSuggestions(list: GeoResult[]): void {
    activeResults = list;
    suggestions.innerHTML = "";
    if (!list.length) {
      hideSuggestions();
      return;
    }
    suggestions.classList.remove("hidden");
    list.forEach((r, idx) => {
      const li = el("li", "suggestion");
      li.setAttribute("role", "option");
      li.dataset.index = String(idx);
      const line1 = el("span", "suggestion-name", r.name);
      const line2 = el("span", "suggestion-meta", [r.admin1, r.country].filter(Boolean).join(" · "));
      li.appendChild(line1);
      li.appendChild(line2);
      suggestions.appendChild(li);
    });
  }

  async function runSearch(): Promise<void> {
    const q = input.value.trim();
    hideSuggestions();
    if (!q) {
      setStatus("Type a place name to search.", "err");
      return;
    }
    localStorage.setItem(STORAGE_KEY, q);
    setStatus("Searching…");
    btn.disabled = true;
    try {
      const coordPin = tryParseLatLon(q);
      if (coordPin) {
        await pickPlace(coordPin);
        return;
      }
      const results = await searchPlaces(q);
      if (!results.length) {
        setStatus(
          "No matches. Try spelling used on Google Maps, add district or state (e.g. Kalitara Birbhum), or paste coordinates like 24.5376, 87.8996.",
          "err"
        );
        return;
      }
      if (results.length === 1) {
        await pickPlace(results[0]);
        return;
      }
      setStatus("Pick a result below.");
      showSuggestions(results);
    } catch {
      setStatus("Network error. Check your connection and try again.", "err");
    } finally {
      btn.disabled = false;
    }
  }

  async function pickPlace(r: GeoResult): Promise<void> {
    hideSuggestions();
    clearLiveRefresh();
    lastPin = null;
    setStatus("Loading forecast…");
    panel.classList.add("hidden");
    const label = r.admin1 ? `${r.name}, ${r.admin1}` : r.name;
    lastPin = { lat: r.latitude, lon: r.longitude, country: r.country, label };
    try {
      const data = await fetchWeather(r.latitude, r.longitude, label, r.country);
      renderWeather(panel, data);
      panel.classList.remove("hidden");
      setStatus("");
      liveRefreshTimer = window.setInterval(() => {
        void refreshLive(true);
      }, LIVE_REFRESH_MS);
    } catch {
      clearLiveRefresh();
      setStatus("Could not load weather. Try again.", "err");
      document.documentElement.dataset.sky = "default";
      lastPin = null;
    }
  }

  async function refreshLive(silent = false): Promise<void> {
    if (!lastPin) return;
    if (!silent) setStatus("Updating from API…");
    try {
      const data = await fetchWeather(lastPin.lat, lastPin.lon, lastPin.label, lastPin.country);
      renderWeather(panel, data);
      setStatus("");
    } catch {
      if (!silent) {
        setStatus("Live update failed. Will retry on the next interval.", "err");
      }
    }
  }

  function formatApiTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  }

  function renderWeather(container: HTMLElement, data: Awaited<ReturnType<typeof fetchWeather>>): void {
    container.innerHTML = "";
    const { current, daily, hourly, place, country, asOfIso } = data;

    document.documentElement.dataset.sky = skyMood(current.code);

    const liveBar = el("div", "live-bar");
    const pulse = el("span", "live-pulse");
    pulse.setAttribute("aria-hidden", "true");
    liveBar.appendChild(pulse);
    liveBar.appendChild(el("span", "live-label", "Live API"));
    const meta = el("span", "live-meta");
    meta.appendChild(document.createTextNode(`Model run · ${formatApiTime(asOfIso)} · `));
    const link = el("a", "live-link", "Open-Meteo") as HTMLAnchorElement;
    link.href = "https://open-meteo.com/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    meta.appendChild(link);
    liveBar.appendChild(meta);
    const refreshBtn = el("button", "btn ghost btn-refresh", "↻ Refresh") as HTMLButtonElement;
    refreshBtn.type = "button";
    refreshBtn.title = "Fetch the latest forecast from the API";
    refreshBtn.addEventListener("click", () => {
      void (async () => {
        refreshBtn.disabled = true;
        try {
          await refreshLive(false);
        } finally {
          refreshBtn.disabled = false;
        }
      })();
    });
    liveBar.appendChild(refreshBtn);
    container.appendChild(liveBar);

    const hero = el("section", "hero");
    hero.appendChild(el("p", "place", `${place}`));
    hero.appendChild(el("p", "country", country));

    const row = el("div", "hero-main");
    const temp = el("div", "temp-wrap");
    temp.appendChild(el("span", "temp-big", `${Math.round(current.tempC)}`));
    temp.appendChild(el("span", "temp-unit", "°C"));
    const side = el("div", "hero-side");
    const iconWrap = el("div", "hero-icon-wrap");
    iconWrap.appendChild(el("div", "hero-icon-glow"));
    iconWrap.appendChild(el("div", "hero-icon", iconForCode(current.code)));
    side.appendChild(iconWrap);
    side.appendChild(el("p", "hero-label", current.label));
    side.appendChild(
      el("p", "hero-feels", `Feels like ${Math.round(current.apparentC)}° · Humidity ${current.humidity}%`)
    );
    side.appendChild(
      el(
        "p",
        "hero-wind",
        `Wind ${Math.round(current.windKmh)} km/h ${windCompass(current.windDirDeg)}`
      )
    );
    row.appendChild(temp);
    row.appendChild(side);
    hero.appendChild(row);
    container.appendChild(hero);

    const hourlySection = el("section", "hourly-section");
    hourlySection.appendChild(el("h2", "section-title", "Next 24 hours (hourly API)"));
    const strip = el("div", "hourly-strip");
    strip.setAttribute("role", "list");
    if (hourly.length === 0) {
      strip.appendChild(el("p", "hourly-empty", "No hourly rows returned for this location."));
    } else {
      hourly.forEach((h) => {
        const cell = el("div", "hour-cell");
        cell.setAttribute("role", "listitem");
        const t = new Date(h.timeIso);
        const timeLabel = Number.isNaN(t.getTime())
          ? h.timeIso.slice(11, 16)
          : t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        cell.appendChild(el("span", "hour-time", timeLabel));
        cell.appendChild(el("span", "hour-icon", iconForCode(h.code)));
        cell.appendChild(el("span", "hour-temp", `${Math.round(h.tempC)}°`));
        if (h.precipProb != null && h.precipProb > 0) {
          cell.appendChild(el("span", "hour-rain", `${h.precipProb}%`));
        }
        cell.title = h.label;
        strip.appendChild(cell);
      });
    }
    hourlySection.appendChild(strip);
    container.appendChild(hourlySection);

    const grid = el("section", "forecast");
    grid.appendChild(el("h2", "section-title", "7-day outlook"));
    const cards = el("div", "forecast-grid");
    daily.forEach((d, i) => {
      const card = el("article", "day-card");
      card.style.setProperty("--stagger", String(i));
      const date = new Date(d.date + "T12:00:00");
      const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
      card.appendChild(el("span", "day-icon", iconForCode(d.code)));
      card.appendChild(el("span", "day-name", weekday));
      card.appendChild(el("span", "day-date", d.date.slice(5)));
      card.appendChild(el("span", "day-range", `${Math.round(d.minC)}° / ${Math.round(d.maxC)}°`));
      if (d.precipProb != null) {
        card.appendChild(el("span", "day-rain", `Rain ${d.precipProb}%`));
      }
      card.title = d.label;
      cards.appendChild(card);
    });
    grid.appendChild(cards);
    container.appendChild(grid);
  }

  input.addEventListener("input", () => {
    if (debounce) clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) {
      hideSuggestions();
      return;
    }
    debounce = setTimeout(async () => {
      try {
        const coordPin = tryParseLatLon(q);
        if (coordPin) {
          showSuggestions([coordPin]);
          return;
        }
        const list = await searchPlaces(q);
        showSuggestions(list);
      } catch {
        hideSuggestions();
      }
    }, 280);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void runSearch();
    }
  });

  btn.addEventListener("click", () => void runSearch());

  suggestions.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest(".suggestion") as HTMLElement | null;
    if (!t || t.dataset.index == null) return;
    const r = activeResults[Number(t.dataset.index)];
    if (r) void pickPlace(r);
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest(".suggestions")) return;
    if ((e.target as HTMLElement).closest(".search-input")) return;
    hideSuggestions();
  });

  document.documentElement.dataset.sky = "default";
}
