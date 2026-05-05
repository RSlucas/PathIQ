import { useState } from "react";
import MapView from "./components/MapView";

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

function App() {
  const [points, setPoints] = useState([null, null]);
  const [routeData, setRouteData] = useState(null);
  const [mode, setMode] = useState("driving");
  const [activePoint, setActivePoint] = useState("origin");

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

        {/* ORIGIN */}
        <div className="sidebar-section">
          <div className="point-header">
            <label className="point-label">Origin</label>

            <button
              className={`set-btn ${activePoint === "origin" ? "active" : ""}`}
              onClick={() => setActivePoint("origin")}
            >
              SET
            </button>
          </div>

          <div className="point-display">
            {points[0] ? fmt(points[0]) : "Not set"}
          </div>
        </div>

        {/* DESTINATION */}
        <div className="sidebar-section">
          <div className="point-header">
            <label className="point-label">Destination</label>

            <button
              className={`set-btn ${
                activePoint === "destination" ? "active" : ""
              }`}
              onClick={() => setActivePoint("destination")}
            >
              SET
            </button>
          </div>

          <div className="point-display">
            {points[1] ? fmt(points[1]) : "Not set"}
          </div>
        </div>

        <div className="sidebar-section">
          <label className="point-label">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          >
            <option value="driving">Driving</option>
            <option value="foot">Walking</option>
            <option value="bike">Cycling</option>
          </select>
        </div>

        {routeData && (
          <div className="sidebar-section">
            <div className="route-stats">
              <div className="stat">
                <span className="stat-value">
                  {fmtDistance(routeData.distance)}
                </span>
                <span className="stat-label">Distance</span>
              </div>

              <div className="stat">
                <span className="stat-value">
                  {fmtDuration(routeData.duration)}
                </span>
                <span className="stat-label">Est. time</span>
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-section">
          <p className="hint-text">
            Select a point, then click on the map
          </p>
        </div>
      </aside>

      <main className="map-area">
        <MapView
          points={points}
          setPoints={setPoints}
          onRouteData={setRouteData}
          mode={mode}
          activePoint={activePoint}
        />
      </main>
    </div>
  );
}

export default App;