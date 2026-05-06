import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMapEvents,
  Polyline,
  Marker,
} from "react-leaflet";

function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function estimateDuration(distance, mode) {
  const speed = { driving: 50, foot: 5, bike: 15 };
  const km = distance / 1000;
  return (km / speed[mode]) * 3600;
}

async function fetchElevation(coords) {
  const locations = coords.map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
  }));

  const res = await fetch("https://api.open-elevation.com/api/v1/lookup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ locations }),
  });

  const data = await res.json();
  return data.results.map((r) => r.elevation);
}

function calculateElevationStats(elevations) {
  let ascent = 0;
  let descent = 0;

  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) ascent += diff;
    else descent += Math.abs(diff);
  }

  return {
    ascent: Math.round(ascent),
    descent: Math.round(descent),
  };
}

export default function MapView({
  points,
  setPoints,
  onRouteData,
  mode,
  activePoint,
  setActivePoint,
}) {
  const [routeCoords, setRouteCoords] = useState([]);

  function handleMapClick(newPoint) {
    setPoints((prev) => {
      const next = [...prev];
      if (activePoint === "origin") {
        next[0] = newPoint;
      } else {
        next[1] = newPoint;
      }
      return next;
    });

    /*if (activePoint === "origin") setActivePoint("destination");
    else setActivePoint("origin");*/
  }

  useEffect(() => {
    if (!points[0] || !points[1]) {
      setRouteCoords([]);
      onRouteData(null);
      return;
    }

    const [a, b] = points;
    const url =
      `https://router.project-osrm.org/route/v1/${mode}/` +
      `${a[1]},${a[0]};${b[1]},${b[0]}` +
      `?overview=full&geometries=geojson`;

    fetch(url)
      .then((r) => r.json())
      .then(async (data) => {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

        setRouteCoords(coords);

        // ⚠️ reducem punctele ca să nu rupem API-ul
        const sampled = coords.filter((_, i) => i % 10 === 0);

        const elevations = await fetchElevation(sampled);
        const elevationStats = calculateElevationStats(elevations);

      onRouteData({
          distance: route.distance,
            duration: estimateDuration(route.distance, mode),
          ...elevationStats,
           elevationProfile: elevations, 
          });
      })
      .catch(console.error);
  }, [points, mode]);

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
      {points[0] && <Marker position={points[0]} />}
      {points[1] && <Marker position={points[1]} />}
      {routeCoords.length > 0 && (
        <Polyline positions={routeCoords} color="#4f8eff" weight={4} opacity={0.85} />
      )}
    </MapContainer>
  );
}