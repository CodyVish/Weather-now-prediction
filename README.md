# Weather Now

A simple, fast weather app for Jamie (Outdoor Enthusiast) to check current conditions for any city using Open-Meteo.

## Features
- City search with Open-Meteo Geocoding API
- Current weather from Open-Meteo Forecast API
- Units toggle (Metric °C/kmh and Imperial °F/mph)
- Recent searches (localStorage)
- Responsive, clean UI with Tailwind CSS
- Loading, error, and empty states

## Tech
- React + TypeScript + Vite
- Tailwind CSS
- Open-Meteo (no API key required)

## Getting Started
```bash
# Install deps
npm install

# Start dev server
npm run dev
```
Open the URL printed in your terminal.

## Build
```bash
npm run build
npm run preview
```

## Deploy (quick options)
- CodeSandbox or StackBlitz: Import this folder or Git repo and run.
- GitHub Pages / Netlify / Vercel: Standard Vite static site deployment.

## Notes
- Geocoding results list top 10 matches; click one to view weather.
- Changing units refetches current conditions for the selected place.
- Weather code mapping is simplified.

## Public APIs
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={city}`
- Weather: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true`

## Screens
- Search • Results • Current Weather card • Error/Empty



