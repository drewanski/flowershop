import React, { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pinIcon = L.divIcon({
  className: 'delivery-pin-icon',
  html: '<span></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

function MapBehavior({ position, onSelect }) {
  const map = useMap();
  useEffect(() => { map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.45 }); }, [map, position]);
  useMapEvents({ click(event) { onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng }); } });
  return null;
}

export default function DeliveryMap({ latitude, longitude, onSelect }) {
  const hasPin = String(latitude ?? '').trim() !== '' && String(longitude ?? '').trim() !== '';
  const position = hasPin && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    ? [Number(latitude), Number(longitude)] : [14.5995, 120.9842];
  return (
    <div className="delivery-map" aria-label="Delivery location map">
      <MapContainer center={position} zoom={13} scrollWheelZoom className="delivery-map-canvas">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapBehavior position={position} onSelect={onSelect} />
        {hasPin && <Marker position={position} icon={pinIcon} draggable eventHandlers={{ dragend(event) { const point = event.target.getLatLng(); onSelect({ latitude: point.lat, longitude: point.lng }); } }} />}
      </MapContainer>
    </div>
  );
}
