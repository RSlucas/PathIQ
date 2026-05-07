import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMapEvents,
  Polyline,
  Marker,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// ─── Marker custom A / B ───────────────────────────────────────────
function makeIcon(label) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:#4f8eff;
      border:2px solid #fff;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    ">
      <span style="
        transform:rotate(45deg);
        font-size:11px;font-weight:700;
        color:#fff;font-family:system-ui;
        line-height:1;
      ">${label}</span>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

const iconA = makeIcon("A");
const iconB = makeIcon("B");

// ─── Legend ────────────────────────────────────────────────────────
function Legend({ visible }) {
  const [expanded, setExpanded] = useState(true);
  if (!visible) return null;

  return (
    <div className="map-legend">
      <button
        className="legend-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="legend-title">Slope</span>
        <span className="legend-toggle-icon">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#ef4444" }} />
            <span className="legend-label">Uphill</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#4f8eff" }} />
            <span className="legend-label">Flat</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#22c55e" }} />
            <span className="legend-label">Downhill</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loading overlay pe hartă ──────────────────────────────────────
function LoadingOverlay({ visible }) {
  if (!visible) return null;
  return (
    <div className="map-loading-overlay">
      <div className="map-loading-pill">
        <span className="loading-dot" />
        Calculating route…
      </div>
    </div>
  );
}

// ─── Click handler ─────────────────────────────────────────────────
function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────
function estimateDuration(distance, mode) {
  const speed = { driving: 50, foot: 5, bike: 15 };
  return (distance / 1000 / speed[mode]) * 3600;
}

const geoCache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPlaceName([lat, lng]) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geoCache.has(key)) return geoCache.get(key);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "RouteIQ-App" } }
    );
    const data = await res.json();
    const name =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      data.display_name?.split(",")[0] ||
      "Unknown";
    geoCache.set(key, name);
    return name;
  } catch {
    return "Unknown";
  }
}

async function fetchElevation(coords) {
  const locations = coords.map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
  }));
  const res = await fetch("https://api.open-elevation.com/api/v1/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locations }),
  });
  const data = await res.json();
  return data.results.map((r) => r.elevation);
}

function calculateElevationStats(elevations) {
  let ascent = 0,
    descent = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) ascent += diff;
    else descent += Math.abs(diff);
  }
  return { ascent: Math.round(ascent), descent: Math.round(descent) };
}

// Grupăm segmentele consecutive de aceeași culoare → mult mai puține Polyline-uri
function buildColoredSegments(coords, elevations) {
  if (!elevations || elevations.length < 2) return [];

  const groups = [];
  let currentColor = null;
  let currentPositions = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const elevIdx = Math.floor(i / 10);
    const nextElevIdx = Math.min(elevIdx + 1, elevations.length - 1);
    const diff = elevations[nextElevIdx] - elevations[elevIdx];

    const color =
      diff > 5 ? "#ef4444" : diff < -5 ? "#22c55e" : "#4f8eff";

    if (color !== currentColor) {
      if (currentPositions.length > 1) {
        groups.push({ positions: currentPositions, color: currentColor });
      }
      currentColor = color;
      currentPositions = [coords[i]];
    }

    currentPositions.push(coords[i + 1]);
  }

  if (currentPositions.length > 1) {
    groups.push({ positions: currentPositions, color: currentColor });
  }

  return groups;
}

// ─── Component principal ───────────────────────────────────────────
export default function MapView({
  points,
  setPoints,
  onRouteData,
  mode,
  avoidHills,
  activePoint,
  onPlaceNames,
  showLegend,
  onLoadingChange,
}) {
  const [routeCoords, setRouteCoords] = useState([]);
  const [coloredSegments, setColoredSegments] = useState([]);
  const [loading, setLoading] = useState(false);

  function setLoadingState(val) {
    setLoading(val);
    onLoadingChange?.(val);
  }

  function handleMapClick(newPoint) {
    setPoints((prev) => {
      const next = [...prev];
      if (activePoint === "origin") next[0] = newPoint;
      else next[1] = newPoint;
      return next;
    });
  }

  // ─── Routing ────────────────────────────────────────────────────
  useEffect(() => {
    if (!points[0] || !points[1]) {
      setRouteCoords([]);
      setColoredSegments([]);
      onRouteData(null);
      return;
    }

    const [a, b] = points;
    const profile =
      mode === "bike" ? "bike" : mode === "foot" ? "foot" : "driving";
    const extras = avoidHills ? "&exclude=motorway,ferry" : "";

    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${a[1]},${a[0]};${b[1]},${b[0]}` +
      `?overview=full&geometries=geojson${extras}`;

    setLoadingState(true);

    fetch(url)
      .then((r) => r.json())
      .then(async (data) => {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lng, lat]) => [
          lat,
          lng,
        ]);
        setRouteCoords(coords);

        const sampled = coords.filter((_, i) => i % 10 === 0);
        const elevations = await fetchElevation(sampled);
        const elevationStats = calculateElevationStats(elevations);
        const segments = buildColoredSegments(coords, elevations);
        setColoredSegments(segments);

        onRouteData({
          distance: route.distance,
          duration: estimateDuration(route.distance, mode),
          ...elevationStats,
          elevationProfile: elevations,
          routeCoords: coords,
        });
      })
      .catch(console.error)
      .finally(() => setLoadingState(false));
  }, [points, mode, avoidHills]);

  // ─── Geocoding ──────────────────────────────────────────────────
  useEffect(() => {
    async function updateNames() {
      const names = [null, null];
      if (points[0]) {
        await sleep(200);
        names[0] = await fetchPlaceName(points[0]);
      }
      if (points[1]) {
        await sleep(200);
        names[1] = await fetchPlaceName(points[1]);
      }
      onPlaceNames?.(names);
    }
    updateNames();
  }, [points]);

  return (
    <MapContainer
      center={[47.6635, 23.581]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={handleMapClick} />

      <Legend visible={showLegend} />
      <LoadingOverlay visible={loading} />

      {points[0] && <Marker position={points[0]} icon={iconA} />}
      {points[1] && <Marker position={points[1]} icon={iconB} />}

      {coloredSegments.length > 0
        ? coloredSegments.map((seg, i) => (
            <Polyline
              key={i}
              positions={seg.positions}
              color={seg.color}
              weight={4}
              opacity={0.9}
            />
          ))
        : routeCoords.length > 0 && (
            <Polyline
              positions={routeCoords}
              color="#4f8eff"
              weight={4}
              opacity={0.85}
            />
          )}
    </MapContainer>
  );
}