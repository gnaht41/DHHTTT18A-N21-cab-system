"use client";

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useDriverStore } from '@/store/driver.store';
import { GeocodeService } from '@/services/driver.mock';
import { LocateFixed } from 'lucide-react';

// ─── Icons ────────────────────────────────────────────────────────────────────

const driverIcon = L.divIcon({
  html: `<div style="background:#00b14f;border:3px solid #fff;width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 25px rgba(0,177,79,0.3);font-size:18px;">🚖</div>`,
  className: 'driver-car-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Passenger pickup marker — RED
const pickupIcon = L.divIcon({
  html: `<div style="background:#ef4444;width:26px;height:26px;border-radius:50%;border:4px solid #fff;box-shadow:0 4px 12px rgba(239,68,68,0.45);"></div>`,
  className: 'pickup-icon',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const destIcon = L.divIcon({
  html: `<div style="background:#1e293b;width:20px;height:20px;border-radius:50%;border:4px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.25);"></div>`,
  className: 'dest-icon',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// ─── Sub-components ────────────────────────────────────────────────────────────

function FitBounds({ coords, points }: { coords: [number, number][] | null; points: [number, number][] }) {
  const map = useMapEvents({});
  const prevKeyRef = useRef<string>('');

  useEffect(() => {
    const key = coords ? `${coords.length}-${coords[0]?.[0]?.toFixed(4)}` : `pts-${points.length}`;
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    if (coords && coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { 
        paddingTopLeft: [30, 90],
        paddingBottomRight: [30, 360],
        animate: true 
      });
    } else if (points.length >= 2) {
      map.fitBounds(points as L.LatLngBoundsLiteral, { 
        paddingTopLeft: [30, 90], 
        paddingBottomRight: [30, 360], 
        animate: true 
      });
    }
  }, [coords, points, map]);

  return null;
}

function CenterOnDriver({ location }: { location: { lat: number; lng: number } | null }) {
  const map = useMapEvents({});
  const lastRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!location) return;
    if (lastRef.current) {
      const dist = Math.abs(lastRef.current.lat - location.lat) + Math.abs(lastRef.current.lng - location.lng);
      if (dist < 0.00005) return;
    }
    lastRef.current = location;
    
    const zoom = map.getZoom();
    const point = map.project([location.lat, location.lng], zoom);
    const newPoint = point.add([0, 150]); 
    const newLatLng = map.unproject(newPoint, zoom);
    
    map.setView(newLatLng, zoom, { animate: true });
  }, [location, map]);

  return null;
}

function MapClickHandler({ 
  onMapClick, 
  enabled 
}: { 
  onMapClick: (lat: number, lng: number) => void; 
  enabled: boolean; 
}) {
  useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// ─── Main Map Component ───────────────────────────────────────────────────────

export default function DriverMap() {
  const rideStatus = useDriverStore((s) => s.rideStatus);
  const isOnline = useDriverStore((s) => s.isOnline);
  const currentRide = useDriverStore((s) => s.currentRide);
  const driverLocation = useDriverStore((s) => s.driverLocation);
  const routeCoordinates = useDriverStore((s) => s.routeCoordinates);
  const moveToLocation = useDriverStore((s) => s.moveToLocation);
  const setDriverLocation = useDriverStore((s) => s.setDriverLocation);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const stored = localStorage.getItem('passengerPickup');
    if (stored) {
      try {
        const { lat, lng } = JSON.parse(stored);
        const offset = 0.002;
        setDriverLocation({
          lat: lat + (Math.random() - 0.5) * offset,
          lng: lng + (Math.random() - 0.5) * offset,
        });
        return;
      } catch { /* fall through to GPS */ }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos.coords.accuracy > 3000) {
            console.warn(`[GPS] Accuracy too poor: ${pos.coords.accuracy}m — ignoring`);
            return;
          }
          setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => { /* GPS unavailable */ },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [initialCenter] = useState<[number, number]>(() => 
    driverLocation ? [driverLocation.lat, driverLocation.lng] : [10.7711, 106.7042]
  );

  // Watch driver's real GPS position — only when IDLE and no passenger ref
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const state = useDriverStore.getState();
        if (state.rideStatus === 'IDLE' && !localStorage.getItem('passengerPickup')) {
          if (pos.coords.accuracy <= 3000) {
            setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        }
      },
      (err) => console.warn('Geolocation error:', err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [setDriverLocation]);

  // Cross-tab sync: snap driver near passenger's pickup when they move their pin
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== 'passengerPickup' || !e.newValue) return;
      const { rideStatus } = useDriverStore.getState();
      if (rideStatus !== 'IDLE') return;
      try {
        const { lat, lng } = JSON.parse(e.newValue);
        const offset = 0.002;
        setDriverLocation({
          lat: lat + (Math.random() - 0.5) * offset,
          lng: lng + (Math.random() - 0.5) * offset,
        });
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [setDriverLocation]);

  // Show loading screen until mounted AND driverLocation is ready
  if (!isMounted || !driverLocation) return (
    <div className="w-full h-full bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-[var(--color-primary)] rounded-full opacity-60" />
          </div>
        </div>
        <div>
          <p className="text-gray-700 text-sm font-semibold">Đang chờ định vị...</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[220px] leading-relaxed">
            Đang xác định vị trí của bạn. Kết quả sẽ hiển thị khi GPS trả về chính xác.
          </p>
        </div>
      </div>
    </div>
  );

  const inActiveRide = ['ACCEPTED', 'ARRIVED_PICKUP', 'IN_PROGRESS'].includes(rideStatus);
  const showPickupMarker = ['ACCEPTED', 'ARRIVED_PICKUP', 'IN_PROGRESS'].includes(rideStatus);
  const showDestMarker = rideStatus === 'IN_PROGRESS';
  const routeColor = '#00b14f'; // Always green

  return (
    <div className="relative w-full h-full">
      <MapContainer
        key="driver-map"
        center={initialCenter}
        zoom={15}
        ref={(m) => { if (m) (window as any)._driverMap = m; }}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Driver location marker */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />
        )}

        {/* Route polyline */}
        {routeCoordinates && routeCoordinates.length > 0 && (
          <Polyline
            positions={routeCoordinates}
            color={routeColor}
            weight={5}
            opacity={0.85}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Pickup marker — RED dot for passenger */}
        {currentRide?.pickup && showPickupMarker && (
          <Marker position={[currentRide.pickup.lat, currentRide.pickup.lng]} icon={pickupIcon} />
        )}

        {/* Destination marker */}
        {currentRide?.destination && showDestMarker && (
          <Marker position={[currentRide.destination.lat, currentRide.destination.lng]} icon={destIcon} />
        )}

        {/* Auto-fit when heading to pickup */}
        {rideStatus === 'ACCEPTED' && driverLocation && currentRide?.pickup && (
          <FitBounds
            coords={routeCoordinates}
            points={[
              [driverLocation.lat, driverLocation.lng],
              [currentRide.pickup.lat, currentRide.pickup.lng],
            ]}
          />
        )}

        {/* Auto-fit when driving to destination */}
        {rideStatus === 'IN_PROGRESS' && currentRide?.pickup && currentRide.destination && (
          <FitBounds
            coords={routeCoordinates}
            points={[
              [currentRide.pickup.lat, currentRide.pickup.lng],
              [currentRide.destination.lat, currentRide.destination.lng],
            ]}
          />
        )}

        {/* Center on driver when idle */}
        {!inActiveRide && <CenterOnDriver location={driverLocation} />}

        <MapClickHandler 
          enabled={isOnline && !inActiveRide}
          onMapClick={(lat, lng) => moveToLocation(lat, lng)}
        />
      </MapContainer>

      {/* ── Recenter button — OUTSIDE MapContainer, as overlay ── */}
      <div className="absolute top-40 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        <button 
          onClick={() => {
            if (driverLocation) {
              const map = (window as any)._driverMap;
              if (map) map.setView([driverLocation.lat, driverLocation.lng], 17, { animate: true });
            }
          }}
          className="bg-white p-2 rounded-full shadow-lg border border-gray-100 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all pointer-events-auto"
          title="Căn giữa vị trí của tôi"
        >
          <LocateFixed size={18} className="text-[var(--color-primary)]" />
        </button>
      </div>
    </div>
  );
}
