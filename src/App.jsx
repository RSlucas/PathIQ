import { useEffect, useState } from "react";
import MapView from "./components/MapView";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function fmt(coord) {
  return coord.map((c) => c.toFixed(5)).join(", ");
}

function fmtDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}min`;
}

function buildElevationData(profile) {
  return profile.map((e, i) => ({ index: i, elevation: e }));
}

// Difficulty: 0-100 bazat pe distanta + ascent
function calcDifficulty(distance, ascent) {
  if (!distance || ascent === undefined) return null;
  const km = distance / 1000;
  const score = Math.min(100, Math.round((km * 2 + ascent * 0.1) / 2));
  if (score < 25) return { label: "Easy", color: "#22c55e", score };
  if (score < 55) return { label: "Moderate", color: "#f59e0b", score };
  if (score < 80) return { label: "Hard", color: "#ef4444", score };
  return { label: "Very hard", color: "#9333ea", score };
}

function readPointsFromURL() {
  const params = new URLSearchParams(window.location.search);
  const a = params.get("a");
  const b = params.get("b");
  const m = params.get("mode");
  return {
    points: [
      a ? a.split(",").map(Number) : null,
      b ? b.split(",").map(Number) : null,
    ],
    mode: m || null,
  };
}

function App() {
  const initial = readPointsFromURL();

  const [points, setPoints] = useState(initial.points);
  const [routeData, setRouteData] = useState(null);
  const [mode, setMode] = useState(initial.mode || "driving");
  const [activePoint, setActivePoint] = useState("origin");
  const [avoidHills, setAvoidHills] = useState(false);
  const [placeNames, setPlaceNames] = useState([null, null]);
  const [history, setHistory] = useState([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const modes = [
    { value: "driving", label: "Driving" },
    { value: "foot", label: "Walking" },
    { value: "bike", label: "Cycling" },
  ];

  useEffect(() => {
    const saved = localStorage.getItem("routes");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!routeData || !points[0] || !points[1]) return;

    const exists = history.some(
      (h) =>
        JSON.stringify(h.from) === JSON.stringify(points[0]) &&
        JSON.stringify(h.to) === JSON.stringify(points[1])
    );
    if (exists) return;

    const newRoute = {
      id: Date.now(),
      from: points[0],
      to: points[1],
      fromName: placeNames[0],
      toName: placeNames[1],
      mode,
      distance: routeData.distance,
      duration: routeData.duration,
    };

    const updated = [newRoute, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("routes", JSON.stringify(updated));
  }, [routeData]);

  function loadRoute(route) {
    setPoints([route.from, route.to]);
    setMode(route.mode);
  }

  function handleReset() {
    setPoints([null, null]);
    setRouteData(null);
    setPlaceNames([null, null]);
    setActivePoint("origin");
    window.history.replaceState({}, "", window.location.pathname);
  }

  function handleSwap() {
    setPoints([points[1], points[0]]);
    setPlaceNames([placeNames[1], placeNames[0]]);
  }

  function handleShare() {
    if (!points[0] || !points[1]) return;
    const params = new URLSearchParams({
      a: points[0].join(","),
      b: points[1].join(","),
      mode,
    });
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }

  function handleGPX() {
    if (!routeData?.routeCoords) return;
    const coords = routeData.routeCoords;

    const trkpts = coords
      .map(([lat, lng]) => `    <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
      .join("\n");

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RouteIQ">
  <trk>
    <name>RouteIQ Export</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "routeiq.gpx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleHistory = showAllHistory ? history : history.slice(0, 3);
  const hasRoute = routeData && points[0] && points[1];
  const hasAnyPoint = points[0] || points[1];
  const hasBothPoints = points[0] && points[1];
  const difficulty = routeData
    ? calcDifficulty(routeData.distance, routeData.ascent)
    : null;

  return (
    <div className="app-layout">
      <aside className="sidebar">

        <div className="sidebar-header">
          <span className="logo-mark">R</span>
          <div>
            <h1 className="app-title">RouteIQ</h1>
            <p className="app-sub">Elevation-aware route planner</p>
          </div>
        </div>

        {/* Points */}
        <div className="sidebar-section">
          <div className="point-row">
            <div className="point-block">
              <div className="point-header">
                <label className="point-label">Origin</label>
                <button
                  className={`set-btn ${activePoint === "origin" ? "active" : ""}`}
                  onClick={() => setActivePoint("origin")}
                >
                  SET
                </button>
              </div>
              <div className={`point-display ${points[0] ? "set" : ""}`}>
                {placeNames[0] || (points[0] ? fmt(points[0]) : "Not set")}
              </div>
            </div>

            {/* Swap button între cele două puncte */}
            <div className="point-connector-row">
              <div className="point-connector" />
              {hasBothPoints && (
                <button
                  className="swap-btn"
                  onClick={handleSwap}
                  title="Swap origin and destination"
                >
                  ⇅
                </button>
              )}
            </div>

            <div className="point-block">
              <div className="point-header">
                <label className="point-label">Destination</label>
                <button
                  className={`set-btn ${activePoint === "destination" ? "active" : ""}`}
                  onClick={() => setActivePoint("destination")}
                >
                  SET
                </button>
              </div>
              <div className={`point-display ${points[1] ? "set" : ""}`}>
                {placeNames[1] || (points[1] ? fmt(points[1]) : "Not set")}
              </div>
            </div>
          </div>

          {hasAnyPoint && (
            <button className="reset-btn" onClick={handleReset}>
              Clear route
            </button>
          )}
        </div>

        {/* Mode + Avoid hills */}
        <div className="sidebar-section">
          <label className="point-label">Travel mode</label>
          <div className="mode-tabs" style={{ marginTop: 8 }}>
            {modes.map((m) => (
              <button
                key={m.value}
                className={`mode-tab ${mode === m.value ? "active" : ""}`}
                onClick={() => setMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            className={`avoid-hills-btn ${avoidHills ? "active" : ""}`}
            onClick={() => setAvoidHills((v) => !v)}
            style={{ marginTop: 10 }}
            disabled={mode === "driving"}
            title={
              mode === "driving"
                ? "Only available for walking and cycling"
                : ""
            }
          >
            {avoidHills ? "Avoiding hills" : "Avoid hills"}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="sidebar-section">
            <div className="loading-row">
              <span className="loading-dot" />
              <span className="loading-text">Calculating route...</span>
            </div>
          </div>
        )}

        {/* Stats + difficulty + elevation */}
        {routeData && !loading && (
          <div className="sidebar-section">

            <div className="route-stats">
              <div className="stat">
                <span className="stat-value">
                  {fmtDistance(routeData.distance)}
                </span>
                <span className="stat-label">Distance</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-value">
                  {fmtDuration(routeData.duration)}
                </span>
                <span className="stat-label">Time</span>
              </div>
            </div>

            {routeData.ascent !== undefined && (
              <div className="elevation-stats">
                <div className="elev-item">
                  <span className="elev-value">+{routeData.ascent}m</span>
                  <span className="elev-label">Ascent</span>
                </div>
                <div className="elev-item">
                  <span className="elev-value">-{routeData.descent}m</span>
                  <span className="elev-label">Descent</span>
                </div>
                {difficulty && (
                  <div className="elev-item" style={{ marginLeft: "auto" }}>
                    <span
                      className="difficulty-badge"
                      style={{
                        background: difficulty.color + "22",
                        color: difficulty.color,
                        borderColor: difficulty.color + "55",
                      }}
                    >
                      {difficulty.label}
                    </span>
                    <span className="elev-label">Difficulty</span>
                  </div>
                )}
              </div>
            )}

            {routeData.elevationProfile && (
              <div className="elevation-chart">
                <p className="chart-label">Elevation profile</p>
                <ResponsiveContainer width="100%" height={110}>
                  <LineChart
                    data={buildElevationData(routeData.elevationProfile)}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <XAxis dataKey="index" hide />
                    <YAxis
                      width={36}
                      tick={{ fill: "#7a7f9a", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}m`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="chart-tooltip">
                            {Math.round(payload[0].value)}m
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="elevation"
                      stroke="#4f8eff"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Export + Share */}
        {hasRoute && !loading && (
          <div className="sidebar-section">
            <label className="point-label">Export & share</label>
            <div className="export-row" style={{ marginTop: 10 }}>
              <button className="export-btn" onClick={handleShare}>
                {shareCopied ? "Link copied!" : "Copy share link"}
              </button>
              <button className="export-btn" onClick={handleGPX}>
                Download GPX
              </button>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="sidebar-section">
            <label className="point-label">Recent routes</label>
            <div className="history-list">
              {visibleHistory.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRoute(r)}
                  className="history-item"
                >
                  <span className="history-names">
                    {r.fromName || "Start"} → {r.toName || "End"}
                  </span>
                  <span className="history-meta">
                    {fmtDistance(r.distance)} · {r.mode}
                  </span>
                </button>
              ))}
            </div>
            {history.length > 3 && (
              <button
                className="show-more-btn"
                onClick={() => setShowAllHistory((v) => !v)}
              >
                {showAllHistory ? "Show less" : `Show all (${history.length})`}
              </button>
            )}
          </div>
        )}

      </aside>

      <main className="map-area">
        <MapView
          points={points}
          setPoints={setPoints}
          onRouteData={setRouteData}
          mode={mode}
          avoidHills={avoidHills}
          activePoint={activePoint}
          onPlaceNames={setPlaceNames}
          showLegend={hasRoute}
          onLoadingChange={setLoading}
        />
      </main>
    </div>
  );
}

export default App;