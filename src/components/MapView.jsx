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
  const speed = {
    driving: 50,
    foot: 5,
    bike: 15,
  };

  const km = distance / 1000;
  return (km / speed[mode]) * 3600;
}

export default function MapView({
  points,
  setPoints,
  onRouteData,
  mode,
  activePoint,
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
      .then((data) => {
        const route = data.routes[0];

        const coords = route.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng]
        );

        setRouteCoords(coords);

        onRouteData({
          distance: route.distance,
          duration: estimateDuration(route.distance, mode),
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
        <Polyline positions={routeCoords} color="#4f8eff" />
      )}
    </MapContainer>
  );
}