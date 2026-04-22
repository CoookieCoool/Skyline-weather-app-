const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const WX = "https://api.open-meteo.com/v1/forecast";
const PHOTON = "https://photon.komoot.io/api/";

/** Extra spellings to try when the main query has no hits (many villages are transliterated differently). */
function spellingAlternates(q: string): string[] {
  const t = q.trim();
  const out: string[] = [];
  if (/antira/i.test(t)) out.push(t.replace(/antira/gi, "itara"));
  if (/nti(?=[aeiou])/i.test(t)) out.push(t.replace(/nti(?=[aeiou])/gi, "ti"));
  if (/Kalantira/i.test(t)) out.push(t.replace(/Kalantira/gi, "Kalitara"));
  return [...new Set(out.map((s) => s.trim()).filter((s) => s.length > 0 && s.toLowerCase() !== t.toLowerCase()))];
}

async function openMeteoGeocode(name: string, countryCode?: string): Promise<GeoResult[]> {
  const url = new URL(GEO);
  url.searchParams.set("name", name);
  url.searchParams.set("count", "15");
  url.searchParams.set("language", "en");
  if (countryCode) url.searchParams.set("country", countryCode);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: GeoResult[] };
  return data.results ?? [];
}

type PhotonFeature = {
  properties?: {
    osm_id?: number;
    name?: string;
    country?: string;
    state?: string;
    county?: string;
    city?: string;
  };
  geometry?: { type?: string; coordinates?: [number, number] };
};

async function searchPhoton(query: string): Promise<GeoResult[]> {
  try {
  const url = new URL(PHOTON);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "18");
  url.searchParams.set("lang", "en");
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const out: GeoResult[] = [];
  for (const f of data.features ?? []) {
    const props = f.properties;
    const coords = f.geometry?.coordinates;
    if (!props || !coords || coords.length < 2) continue;
    const lon = coords[0];
    const lat = coords[1];
    const name = props.name?.trim();
    if (!name) continue;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const id =
      typeof props.osm_id === "number" && Number.isFinite(props.osm_id)
        ? props.osm_id
        : Math.round((lat + 90) * 10000 + (lon + 180) * 10);
    const admin = props.state ?? props.county ?? props.city;
    out.push({
      id,
      name,
      latitude: lat,
      longitude: lon,
      country: props.country ?? "",
      admin1: admin,
    });
    if (out.length >= 15) break;
  }
  return out;
  } catch {
    return [];
  }
}

/**
 * Parse "lat, lon" or "lat lon" (decimal degrees). First value is treated as latitude if |lat| ≤ 90.
 */
export function tryParseLatLon(query: string): GeoResult | null {
  const m = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]+\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  let a = parseFloat(m[1]);
  let b = parseFloat(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  let lat = a;
  let lon = b;
  if (Math.abs(a) > 90 && Math.abs(b) <= 90) {
    lat = b;
    lon = a;
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const id = -Math.abs(Math.round(lat * 1e5) * 1000 + Math.round(lon * 1e5));
  return {
    id,
    name: "Pinned map location",
    latitude: lat,
    longitude: lon,
    country: "Coordinates",
    admin1: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
  };
}

export type GeoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
};

export type HourlyPoint = {
  timeIso: string;
  tempC: number;
  code: number;
  label: string;
  precipProb: number | null;
};

export type WeatherBundle = {
  place: string;
  country: string;
  /** ISO time string from the API for the current conditions snapshot */
  asOfIso: string;
  current: {
    tempC: number;
    apparentC: number;
    humidity: number;
    windKmh: number;
    windDirDeg: number;
    code: number;
    label: string;
  };
  /** Next 24 hours from the API hourly forecast */
  hourly: HourlyPoint[];
  daily: {
    date: string;
    minC: number;
    maxC: number;
    code: number;
    label: string;
    precipProb: number | null;
  }[];
};

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];

  let results = await openMeteoGeocode(q);
  if (!results.length) results = await openMeteoGeocode(q, "IN");

  if (!results.length) {
    for (const alt of spellingAlternates(q)) {
      results = await openMeteoGeocode(alt);
      if (results.length) break;
      results = await openMeteoGeocode(alt, "IN");
      if (results.length) break;
    }
  }

  if (!results.length) {
    results = await searchPhoton(q);
  }
  if (!results.length) {
    results = await searchPhoton(`${q} India`);
  }

  return results;
}

function wmoLabel(code: number): string {
  const m: Record<number, string> = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Violent showers",
    95: "Thunderstorm",
    96: "Thunderstorm & hail",
    99: "Thunderstorm & hail",
  };
  return m[code] ?? "Weather";
}

function sliceHourlyFromCurrent(
  asOfIso: string,
  times: string[],
  temps: number[],
  codes: number[],
  precip: (number | null)[],
  count: number
): HourlyPoint[] {
  let start = times.findIndex((t) => t >= asOfIso);
  if (start < 0) start = 0;
  const out: HourlyPoint[] = [];
  for (let i = start; i < start + count && i < times.length; i++) {
    const c = codes[i];
    out.push({
      timeIso: times[i],
      tempC: temps[i],
      code: c,
      label: wmoLabel(c),
      precipProb: precip[i] ?? null,
    });
  }
  return out;
}

export async function fetchWeather(lat: number, lon: number, placeLabel: string, country: string): Promise<WeatherBundle> {
  const url = new URL(WX);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m"
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,weather_code,precipitation_probability"
  );
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Weather request failed");
  const j = (await res.json()) as {
    current: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      apparent_temperature: number;
      weather_code: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
    };
    hourly: {
      time: string[];
      temperature_2m: number[];
      weather_code: number[];
      precipitation_probability: (number | null)[];
    };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: (number | null)[];
    };
  };

  const asOfIso = j.current.time;
  const code = j.current.weather_code;
  const days: WeatherBundle["daily"] = j.daily.time.map((date, i) => ({
    date,
    minC: j.daily.temperature_2m_min[i],
    maxC: j.daily.temperature_2m_max[i],
    code: j.daily.weather_code[i],
    label: wmoLabel(j.daily.weather_code[i]),
    precipProb: j.daily.precipitation_probability_max[i] ?? null,
  }));

  const hourly = sliceHourlyFromCurrent(
    asOfIso,
    j.hourly.time,
    j.hourly.temperature_2m,
    j.hourly.weather_code,
    j.hourly.precipitation_probability,
    24
  );

  return {
    place: placeLabel,
    country,
    asOfIso,
    current: {
      tempC: j.current.temperature_2m,
      apparentC: j.current.apparent_temperature,
      humidity: j.current.relative_humidity_2m,
      windKmh: j.current.wind_speed_10m,
      windDirDeg: j.current.wind_direction_10m,
      code,
      label: wmoLabel(code),
    },
    hourly,
    daily: days,
  };
}

export function windCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const i = Math.round(deg / 45) % 8;
  return dirs[i];
}
