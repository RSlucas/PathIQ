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
  return profile.map((e, i) => ({
    index: i,
    elevation: e,
  }));
}

function App() {
  const [points, setPoints] = useState([null, null]);
  const [routeData, setRouteData] = useState(null);
  const [mode, setMode] = useState("driving");
  const [activePoint, setActivePoint] = useState("origin");
  const [avoidHills, setAvoidHills] = useState(false);
  const [placeNames, setPlaceNames] = useState([null, null]);

  const [history, setHistory] = useState([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const modes = [
    { value: "driving", label: "Driving" },
    { value: "foot", label: "Walking" },
    { value: "bike", label: "Cycling" },
  ];

  // load history
  useEffect(() => {
    const saved = localStorage.getItem("routes");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // save route (NO DUPLICATES)
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

  const visibleHistory = showAllHistory ? history : history.slice(0, 3);

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

        {/* POINTS */}
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

            <div className="point-connector" />

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
        </div>

        {/* MODE */}
        <div className="sidebar-section">
          <label className="point-label">Travel mode</label>

          <div style={{ marginTop: 10 }}>
            <button
              className={`mode-tab ${avoidHills ? "active" : ""}`}
              onClick={() => setAvoidHills(v => !v)}
            >
              Avoid hills
            </button>
          </div>

          <div className="mode-tabs">
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
        </div>

        

        {/* STATS + CHART */}
        {routeData && (
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

            {/* ELEVATION GRAPH (BACK) */}
            {routeData.elevationProfile && (
              <div style={{ width: "100%", height: 120, marginTop: 16 }}>
                <ResponsiveContainer>
                  <LineChart data={buildElevationData(routeData.elevationProfile)}>
                    <XAxis dataKey="index" hide />
                    <YAxis hide />
                    <Tooltip />
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

        {/* HISTORY */}
        <div className="sidebar-section">
          <label className="point-label">History</label>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {visibleHistory.map((r) => (
              <button
                key={r.id}
                onClick={() => loadRoute(r)}
                className="mode-tab"
                style={{ textAlign: "left" }}
              >
                {r.fromName || "Start"} → {r.toName || "End"}
              </button>
            ))}
          </div>

          {history.length > 3 && (
            <button
              className="mode-tab"
              style={{ marginTop: 10 }}
              onClick={() => setShowAllHistory(v => !v)}
            >
              {showAllHistory ? "Show less" : "See more"}
            </button>
          )}
        </div>

      </aside>

      <main className="map-area">
        <MapView
          points={points}
          setPoints={setPoints}
          onRouteData={setRouteData}
          mode={mode}
          activePoint={activePoint}
          setActivePoint={setActivePoint}
          onPlaceNames={setPlaceNames}
        />
      </main>

    </div>
  );
}

export default App;