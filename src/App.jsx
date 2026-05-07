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

function calcDifficulty(distance, ascent) {
  if (!distance || ascent === undefined) return null;

  const km = distance / 1000;
  const score = Math.min(
    100,
    Math.round((km * 2 + ascent * 0.1) / 2)
  );

  if (score < 25)
    return {
      label: "Easy",
      color: "#22c55e",
      score,
    };

  if (score < 55)
    return {
      label: "Moderate",
      color: "#f59e0b",
      score,
    };

  if (score < 80)
    return {
      label: "Hard",
      color: "#ef4444",
      score,
    };

  return {
    label: "Very hard",
    color: "#9333ea",
    score,
  };
}

function readPointsFromURL() {
  const params = new URLSearchParams(
    window.location.search
  );

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

  const [mode, setMode] = useState(
    initial.mode || "driving"
  );

  const [activePoint, setActivePoint] =
    useState("origin");

  const [avoidHills, setAvoidHills] =
    useState(false);

  const [placeNames, setPlaceNames] = useState([
    null,
    null,
  ]);

  const [history, setHistory] = useState([]);

  const [favorites, setFavorites] = useState([]);

  const [showAllHistory, setShowAllHistory] =
    useState(false);

  const [showHistory, setShowHistory] =
    useState(false);

  const [shareCopied, setShareCopied] =
    useState(false);

  const [loading, setLoading] = useState(false);

  // SEARCH
  const [searchOrigin, setSearchOrigin] =
    useState("");

  const [
    searchDestination,
    setSearchDestination,
  ] = useState("");

  const [originResults, setOriginResults] =
    useState([]);

  const [
    destinationResults,
    setDestinationResults,
  ] = useState([]);

  const modes = [
    { value: "driving", label: "Driving" },
    { value: "foot", label: "Walking" },
    { value: "bike", label: "Cycling" },
  ];

  // LOAD HISTORY
  useEffect(() => {
    const saved = localStorage.getItem("routes");

    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // LOAD FAVORITES
  useEffect(() => {
    const saved = localStorage.getItem(
      "favoriteRoutes"
    );

    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  // SEARCH ORIGIN
  useEffect(() => {
    if (searchOrigin.length < 3) {
      setOriginResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchOrigin
          )}`
        );

        const data = await res.json();

        setOriginResults(data.slice(0, 5));
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchOrigin]);

  // SEARCH DESTINATION
  useEffect(() => {
    if (searchDestination.length < 3) {
      setDestinationResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchDestination
          )}`
        );

        const data = await res.json();

        setDestinationResults(data.slice(0, 5));
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchDestination]);

  // SAVE HISTORY
  useEffect(() => {
    if (!routeData || !points[0] || !points[1])
      return;

    const exists = history.some(
      (h) =>
        JSON.stringify(h.from) ===
          JSON.stringify(points[0]) &&
        JSON.stringify(h.to) ===
          JSON.stringify(points[1])
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

    const updated = [newRoute, ...history].slice(
      0,
      10
    );

    setHistory(updated);

    localStorage.setItem(
      "routes",
      JSON.stringify(updated)
    );
  }, [routeData]);

  function loadRoute(route) {
    setPoints([route.from, route.to]);
    setMode(route.mode);
  }

  function handleFavorite() {
    if (!routeData) return;

    const route = {
      id: Date.now(),
      from: points[0],
      to: points[1],
      fromName: placeNames[0],
      toName: placeNames[1],
      mode,
      distance: routeData.distance,
    };

    const updated = [route, ...favorites];

    setFavorites(updated);

    localStorage.setItem(
      "favoriteRoutes",
      JSON.stringify(updated)
    );
  }

  const visibleHistory = showAllHistory
    ? history
    : history.slice(0, 3);

  const hasRoute =
    routeData && points[0] && points[1];

  const difficulty = routeData
    ? calcDifficulty(
        routeData.distance,
        routeData.ascent
      )
    : null;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-mark">P</span>

          <div>
            <h1 className="app-title">PathIQ</h1>

            <p className="app-sub">
              Explore routes intelligently
            </p>
          </div>
        </div>

        {/* ORIGIN + DESTINATION */}
        <div className="sidebar-section">
          <div className="point-row">
            {/* ORIGIN */}
            <div className="point-block">
              <div className="point-header">
                <label className="point-label">
                  Origin
                </label>

                <button
                  className={`set-btn ${
                    activePoint === "origin"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setActivePoint("origin")
                  }
                >
                  SET
                </button>
              </div>

              <div
                className={`point-display ${
                  points[0] ? "set" : ""
                }`}
              >
                {placeNames[0] ||
                  (points[0]
                    ? fmt(points[0])
                    : "Not set")}
              </div>

              <input
                className="search-input"
                placeholder="Search origin..."
                value={searchOrigin}
                onChange={(e) =>
                  setSearchOrigin(e.target.value)
                }
              />

              {originResults.length > 0 && (
                <div className="search-results">
                  {originResults.map((r) => (
                    <button
                      key={r.place_id}
                      className="search-result-item"
                      onClick={() => {
                        setPoints((prev) => [
                          [
                            parseFloat(r.lat),
                            parseFloat(r.lon),
                          ],
                          prev[1],
                        ]);

                        setPlaceNames((prev) => [
                          r.display_name,
                          prev[1],
                        ]);

                        setSearchOrigin("");
                        setOriginResults([]);
                      }}
                    >
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* DESTINATION */}
            <div
              className="point-block"
              style={{ marginTop: 16 }}
            >
              <div className="point-header">
                <label className="point-label">
                  Destination
                </label>

                <button
                  className={`set-btn ${
                    activePoint ===
                    "destination"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setActivePoint(
                      "destination"
                    )
                  }
                >
                  SET
                </button>
              </div>

              <div
                className={`point-display ${
                  points[1] ? "set" : ""
                }`}
              >
                {placeNames[1] ||
                  (points[1]
                    ? fmt(points[1])
                    : "Not set")}
              </div>

              <input
                className="search-input"
                placeholder="Search destination..."
                value={searchDestination}
                onChange={(e) =>
                  setSearchDestination(
                    e.target.value
                  )
                }
              />

              {destinationResults.length > 0 && (
                <div className="search-results">
                  {destinationResults.map((r) => (
                    <button
                      key={r.place_id}
                      className="search-result-item"
                      onClick={() => {
                        setPoints((prev) => [
                          prev[0],
                          [
                            parseFloat(r.lat),
                            parseFloat(r.lon),
                          ],
                        ]);

                        setPlaceNames((prev) => [
                          prev[0],
                          r.display_name,
                        ]);

                        setSearchDestination(
                          ""
                        );

                        setDestinationResults(
                          []
                        );
                      }}
                    >
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODE */}
        <div className="sidebar-section">
          <label className="point-label">
            Travel mode
          </label>

          <div
            className="mode-tabs"
            style={{ marginTop: 8 }}
          >
            {modes.map((m) => (
              <button
                key={m.value}
                className={`mode-tab ${
                  mode === m.value
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setMode(m.value)
                }
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            className={`avoid-hills-btn ${
              avoidHills ? "active" : ""
            }`}
            onClick={() =>
              setAvoidHills((v) => !v)
            }
            style={{ marginTop: 10 }}
          >
            {avoidHills
              ? "Avoiding hills"
              : "Avoid hills"}
          </button>
        </div>

        {/* STATS */}
        {routeData && !loading && (
          <div className="sidebar-section">
            <div className="route-stats">
              <div className="stat">
                <span className="stat-value">
                  {fmtDistance(
                    routeData.distance
                  )}
                </span>

                <span className="stat-label">
                  Distance
                </span>
              </div>

              <div className="stat-divider" />

              <div className="stat">
                <span className="stat-value">
                  {fmtDuration(
                    routeData.duration
                  )}
                </span>

                <span className="stat-label">
                  Time
                </span>
              </div>
            </div>

            {difficulty && (
              <div className="elevation-stats">
                <div className="elev-item">
                  <span
                    className="difficulty-badge"
                    style={{
                      background:
                        difficulty.color + "22",
                      color: difficulty.color,
                      borderColor:
                        difficulty.color + "55",
                    }}
                  >
                    {difficulty.label}
                  </span>

                  <span className="elev-label">
                    Difficulty
                  </span>
                </div>
              </div>
            )}

            {routeData.elevationProfile && (
              <div className="elevation-chart">
                <p className="chart-label">
                  Elevation profile
                </p>

                <ResponsiveContainer
                  width="100%"
                  height={110}
                >
                  <LineChart
                    data={buildElevationData(
                      routeData.elevationProfile
                    )}
                  >
                    <XAxis
                      dataKey="index"
                      hide
                    />

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

        {/* FAVORITE BUTTON */}
        {hasRoute && (
          <div className="sidebar-section">
            <button
              className="export-btn"
              onClick={handleFavorite}
            >
              Save favorite
            </button>
          </div>
        )}

        {/* FAVORITES */}
        {favorites.length > 0 && (
          <div className="sidebar-section">
            <label className="point-label">
              Favorites
            </label>

            <div className="history-list">
              {favorites.map((r) => (
                <button
                  key={r.id}
                  onClick={() =>
                    loadRoute(r)
                  }
                  className="history-item"
                >
                  <span className="history-names">
                    {r.fromName} →{" "}
                    {r.toName}
                  </span>

                  <span className="history-meta">
                    {fmtDistance(r.distance)} ·{" "}
                    {r.mode}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* HISTORY */}
        {history.length > 0 && (
          <div className="sidebar-section">
            <button
              className="show-more-btn"
              onClick={() =>
                setShowHistory((v) => !v)
              }
            >
              {showHistory
                ? "Hide recent routes"
                : `Show recent routes (${history.length})`}
            </button>

            {showHistory && (
              <>
                <div
                  className="history-list"
                  style={{ marginTop: 12 }}
                >
                  {visibleHistory.map((r) => (
                    <button
                      key={r.id}
                      onClick={() =>
                        loadRoute(r)
                      }
                      className="history-item"
                    >
                      <span className="history-names">
                        {r.fromName ||
                          "Start"}{" "}
                        →{" "}
                        {r.toName ||
                          "End"}
                      </span>

                      <span className="history-meta">
                        {fmtDistance(
                          r.distance
                        )}{" "}
                        · {r.mode}
                      </span>
                    </button>
                  ))}
                </div>

                {history.length > 3 && (
                  <button
                    className="show-more-btn"
                    onClick={() =>
                      setShowAllHistory(
                        (v) => !v
                      )
                    }
                    style={{
                      marginTop: 10,
                    }}
                  >
                    {showAllHistory
                      ? "Show less"
                      : `Show all (${history.length})`}
                  </button>
                )}
              </>
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