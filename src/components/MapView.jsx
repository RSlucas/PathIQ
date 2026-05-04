import { MapContainer, TileLayer } from "react-leaflet";

export default function MapView() {
  return (
    <MapContainer
      center={[47.6635, 23.5810]}
      zoom={13}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
}