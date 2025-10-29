import { useEffect, useMemo, useState } from 'react';

type GeoResult = {
	name: string;
	country: string;
	country_code?: string;
	latitude: number;
	longitude: number;
	admin1?: string;
	feature_code?: string;
};

type CurrentWeather = {
	temperature: number;
	windspeed: number;
	winddirection: number;
	weathercode: number;
	// Unix seconds since epoch (UTC) from API when timeformat=unixtime
	time: number;
	timezone: string;
};

type Units = 'metric' | 'imperial';

const LOCAL_STORAGE_KEY = 'weather-now:recent-searches:v1';

function useRecentSearches() {
	const [recent, setRecent] = useState<string[]>(() => {
		try {
			const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
			return raw ? (JSON.parse(raw) as string[]) : [];
		} catch {
			return [];
		}
	});

	useEffect(() => {
		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(recent.slice(0, 5)));
	}, [recent]);

	function add(term: string) {
		setRecent(prev => {
			const next = [term, ...prev.filter(x => x.toLowerCase() !== term.toLowerCase())];
			return next.slice(0, 5);
		});
	}

	return { recent, add };
}

function unitLabel(units: Units) {
	return units === 'metric' ? { temp: '°C', wind: 'km/h' } : { temp: '°F', wind: 'mph' };
}

function weatherCodeToText(code: number) {
	// Simplified mapping per Open-Meteo docs
	const map: Record<number, string> = {
		0: 'Clear sky',
		1: 'Mainly clear',
		2: 'Partly cloudy',
		3: 'Overcast',
		45: 'Fog',
		48: 'Depositing rime fog',
		51: 'Light drizzle',
		53: 'Moderate drizzle',
		55: 'Dense drizzle',
		61: 'Slight rain',
		63: 'Moderate rain',
		65: 'Heavy rain',
		71: 'Slight snow',
		73: 'Moderate snow',
		75: 'Heavy snow',
		80: 'Rain showers',
		81: 'Moderate showers',
		82: 'Violent showers',
		95: 'Thunderstorm',
		96: 'Thunderstorm w/ hail',
		99: 'Thunderstorm w/ hail',
	};
	return map[code] ?? 'Unknown';
}

export default function App() {
	const [query, setQuery] = useState('');
	const [units, setUnits] = useState<Units>('metric');
	const [geoResults, setGeoResults] = useState<GeoResult[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selected, setSelected] = useState<GeoResult | null>(null);
	const [current, setCurrent] = useState<CurrentWeather | null>(null);
	const [nowMs, setNowMs] = useState<number>(Date.now());
	const { recent, add } = useRecentSearches();

	const { temp, wind } = useMemo(() => unitLabel(units), [units]);

	async function searchCity(text: string) {
		if (!text.trim()) return;
		setLoading(true);
		setError(null);
		setSelected(null);
		setCurrent(null);
		try {
			// Support a trailing country code, e.g. "Delhi, IN"
			const parts = text.split(',');
			const maybeCountry = parts.length > 1 ? parts[parts.length - 1].trim() : '';
			const parsedCountry = /^[A-Za-z]{2}$/.test(maybeCountry) ? maybeCountry.toUpperCase() : null;
			const cleanedName = (parsedCountry ? parts.slice(0, -1).join(',') : text).trim();

			const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
			url.searchParams.set('name', cleanedName);
			url.searchParams.set('count', '10');
			url.searchParams.set('language', 'en');
			url.searchParams.set('format', 'json');
			const res = await fetch(url.toString());
			if (!res.ok) throw new Error('Failed to search');
			const data = await res.json();
			const rawResults: GeoResult[] = (data.results ?? []).map((r: any) => ({
				name: r.name,
				country: r.country,
				country_code: r.country_code,
				latitude: r.latitude,
				longitude: r.longitude,
				admin1: r.admin1,
				feature_code: r.feature_code,
			}));

			// Prefer cities and populated places by feature_code
			const cityCodes = new Set([
				'PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4',
				'PPL', 'PPLF', 'PPLG', 'PPLS', 'PPLX',
			]);
			let filtered = rawResults.filter(r => cityCodes.has(r.feature_code ?? ''));
			if (parsedCountry) {
				filtered = filtered.filter(r => (r.country_code ?? '').toUpperCase() === parsedCountry);
			}
			// Fallback: if filtering removed everything, show the raw results
			const results = filtered.length > 0 ? filtered : rawResults;
			setGeoResults(results);
			add(text);
		} catch (e: any) {
			setError(e?.message ?? 'Something went wrong');
			setGeoResults([]);
		} finally {
			setLoading(false);
		}
	}

	async function fetchCurrentWeather(place: GeoResult) {
		setLoading(true);
		setError(null);
		setSelected(place);
		setCurrent(null);
		try {
			const isMetric = units === 'metric';
			const url = new URL('https://api.open-meteo.com/v1/forecast');
			url.searchParams.set('latitude', String(place.latitude));
			url.searchParams.set('longitude', String(place.longitude));
			url.searchParams.set('current_weather', 'true');
			// Ensure API returns times relative to the location, and in unix time
			url.searchParams.set('timezone', 'auto');
			url.searchParams.set('timeformat', 'unixtime');
			url.searchParams.set('temperature_unit', isMetric ? 'celsius' : 'fahrenheit');
			url.searchParams.set('windspeed_unit', isMetric ? 'kmh' : 'mph');
			const res = await fetch(url.toString());
			if (!res.ok) throw new Error('Failed to fetch weather');
			const data = await res.json();
			const cw = data.current_weather;
			const parsed: CurrentWeather = {
				temperature: cw.temperature,
				windspeed: cw.windspeed,
				winddirection: cw.winddirection,
				weathercode: cw.weathercode,
				time: cw.time, // unix seconds
				timezone: data.timezone,
			};
			setCurrent(parsed);
		} catch (e: any) {
			setError(e?.message ?? 'Something went wrong');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		// Live clock tick
		const id = window.setInterval(() => setNowMs(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, []);

	useEffect(() => {
		if (selected) {
			fetchCurrentWeather(selected);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [units]);

	return (
		<div className="min-h-full flex flex-col">
			<header className="border-b border-slate-200/60 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur sticky top-0 z-10">
				<div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
					<div className="font-semibold text-2xl md:text-3xl">Weather Now</div>
					<div className="ml-auto flex items-center gap-2 text-sm">
						<span className="text-slate-500">Units</span>
						<div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
							<button
								className={`px-3 py-1 ${units === 'metric' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`}
								onClick={() => setUnits('metric')}
							>
								Metric
							</button>
							<button
								className={`px-3 py-1 ${units === 'imperial' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`}
								onClick={() => setUnits('imperial')}
							>
								Imperial
							</button>
						</div>
					</div>
				</div>
			</header>

			<main className="flex-1">
				<div className="max-w-3xl mx-auto px-4 py-6">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							searchCity(query);
						}}
						className="flex gap-2"
					>
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
				placeholder="Search city (e.g., Delhi, IN or London)"
						/>
						<button
							type="submit"
							className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2"
							disabled={loading}
						>
							{loading ? 'Searching…' : 'Search'}
						</button>
					</form>

					{recent.length > 0 && (
						<div className="mt-3 text-sm text-slate-600 dark:text-slate-400 flex flex-wrap gap-2">
							<span className="text-slate-500">Recent:</span>
							{recent.map((r) => (
								<button key={r} className="underline hover:text-sky-600" onClick={() => { setQuery(r); searchCity(r); }}>
									{r}
								</button>
							))}
						</div>
					)}

					{error && (
						<div className="mt-4 rounded-lg border border-red-300 bg-red-50 text-red-800 px-3 py-2">
							{error}
						</div>
					)}

					{geoResults && geoResults.length === 0 && !loading && !error && (
						<div className="mt-6 text-slate-600">No cities found.</div>
					)}

					{geoResults && geoResults.length > 0 && (
						<div className="mt-6 grid gap-3">
							{geoResults.map((g) => (
								<button
									key={`${g.name}-${g.latitude}-${g.longitude}`}
									onClick={() => fetchCurrentWeather(g)}
									className={`text-left rounded-lg border p-3 hover:border-sky-400 ${selected && g.latitude === selected.latitude && g.longitude === selected.longitude ? 'border-sky-500 ring-2 ring-sky-200' : 'border-slate-200 dark:border-slate-700'}`}
								>
									<div className="font-medium">{g.name}{g.admin1 ? `, ${g.admin1}` : ''}</div>
									<div className="text-sm text-slate-600 dark:text-slate-400">{g.country} • {g.latitude.toFixed(2)}, {g.longitude.toFixed(2)}</div>
								</button>
							))}
						</div>
					)}

					{selected && current && (
						<div className="mt-8">
							<div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white/70 dark:bg-slate-800/70">
								<div className="flex items-start justify-between gap-4 flex-wrap">
						<div>
							<div className="text-lg font-semibold">{selected.name}{selected.admin1 ? `, ${selected.admin1}` : ''}</div>
							<div className="text-slate-600 dark:text-slate-400 text-sm">
								<span className="font-medium">Local time:</span> {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: current.timezone }).format(new Date(nowMs))}
								<span className="opacity-70"> ({current.timezone})</span>
							</div>
							<div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
								Observed: {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: current.timezone }).format(new Date(current.time * 1000))}
							</div>
						</div>
									<div className="text-5xl font-bold">{Math.round(current.temperature)}{temp}</div>
								</div>
								<div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
									<div className="rounded-lg bg-slate-100 dark:bg-slate-700/50 p-3">
										<div className="text-slate-500">Condition</div>
										<div className="font-medium">{weatherCodeToText(current.weathercode)}</div>
									</div>
									<div className="rounded-lg bg-slate-100 dark:bg-slate-700/50 p-3">
										<div className="text-slate-500">Wind</div>
										<div className="font-medium">{Math.round(current.windspeed)} {wind} • {current.winddirection}°</div>
									</div>
									<div className="rounded-lg bg-slate-100 dark:bg-slate-700/50 p-3">
										<div className="text-slate-500">Coordinates</div>
										<div className="font-medium">{selected.latitude.toFixed(2)}, {selected.longitude.toFixed(2)}</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</main>

			<footer className="mt-auto py-6 text-center text-sm text-slate-500">
				Built with Open-Meteo, React, and Tailwind CSS.
			</footer>
		</div>
	);
}



