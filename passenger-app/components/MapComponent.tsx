"use client";

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMapEvents, Marker, Polyline, useMap } from 'react-leaflet';
import { useLocationStore } from '@/store/location.store';
import { LocateFixed } from 'lucide-react';
import L from 'leaflet';

// ─── Helpers & Sub-components ────────────────────────────────────────────────

const carIconHTML = `<div style="background-color: #fde047; border: 2px solid #000; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-size: 20px;">🚕</div>`;

// Separated component for all layers to ensure map context is ready
const MapLayers = ({ icons, initialCenter }: { icons: any, initialCenter: any }) => {
  const mapCenter = useLocationStore((state) => state.mapCenter);
  const uiState = useLocationStore((state) => state.uiState);
  const pickup = useLocationStore((state) => state.pickup);
  const destination = useLocationStore((state) => state.destination);
  const routeCoordinates = useLocationStore((state) => state.routeCoordinates);
  const driverApproachCoords = useLocationStore((state) => state.driverApproachCoords);
  const driverLocation = useLocationStore((state) => state.driverLocation);
  
  // All states where the ride context is active (markers + route should show)
  const inRideFlow = ['confirm', 'finding_driver', 'driver_on_way', 'driver_arrived', 'riding', 'arrived'].includes(uiState);
  const isDriverOnWay = uiState === 'driver_on_way';
  const isRiding = ['confirm', 'finding_driver', 'driver_arrived', 'riding', 'arrived'].includes(uiState);

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {uiState === 'map' && <MapEventListener />}
      {mapCenter && !inRideFlow && <InitialCenterSetter center={mapCenter} />}
      
      {/* Driver approach route: green dashed line while driver is on the way */}
      {driverApproachCoords && isDriverOnWay && (
        <Polyline 
          positions={driverApproachCoords} 
          color="#00b14f"
          weight={4}
          opacity={0.75}
          lineCap="round"
          lineJoin="round"
          dashArray="8, 6"
        />
      )}

      {/* Main trip route: blue line from pickup to destination */}
      {routeCoordinates && isRiding && (
        <Polyline 
          positions={routeCoordinates} 
          color="#3b82f6" 
          weight={5} 
          opacity={0.8}
          lineCap="round"
          lineJoin="round"
        />
      )}

      {inRideFlow && pickup && (
         <Marker position={[pickup.lat, pickup.lng]} icon={icons.pickup} />
      )}
      {inRideFlow && destination && (
         <Marker position={[destination.lat, destination.lng]} icon={icons.dest} />
      )}

      {driverLocation && ['driver_on_way', 'driver_arrived', 'riding', 'arrived'].includes(uiState) && (
         <Marker position={[driverLocation.lat, driverLocation.lng]} icon={icons.car} />
      )}

      {inRideFlow && pickup && destination && (
         <FitBounds routeCoords={driverApproachCoords || routeCoordinates} pickup={pickup} destination={destination} />
      )}
    </>
  );
};

const MapEventListener = () => {
  const setMapCenter = useLocationStore((state) => state.setMapCenter);
  const setIsReverseGeocoding = useLocationStore((state) => state.setIsReverseGeocoding);
  const lastZoomRef = useRef<number | null>(null);
  const wasDraggedRef = useRef(false);

  useMapEvents({
    dragstart: () => {
      wasDraggedRef.current = true;
      setIsReverseGeocoding(true);
    },
    moveend: (e) => {
      const currentZoom = e.target.getZoom();
      
      // If wasDraggedRef is false, it means the move was triggered by zoom or code
      if (!wasDraggedRef.current) {
        lastZoomRef.current = currentZoom;
        return;
      }

      // If zoom level also changed, it might be a pinch-zoom-drag combo
      // In most cases, we only want updates on pure drag
      if (lastZoomRef.current !== null && lastZoomRef.current !== currentZoom) {
        lastZoomRef.current = currentZoom;
        wasDraggedRef.current = false;
        return;
      }

      const center = e.target.getCenter();
      setMapCenter({ lat: center.lat, lng: center.lng });
      
      // Reset flag after drag-induced move completes
      wasDraggedRef.current = false;
      lastZoomRef.current = currentZoom;
    },
  });
  return null;
};

const InitialCenterSetter = ({ center }: { center: { lat: number; lng: number } }) => {
  const map = useMapEvents({});
  useEffect(() => {
    if (!center) return;
    const current = map.getCenter();
    if (Math.abs(current.lat - center.lat) > 0.00005 || Math.abs(current.lng - center.lng) > 0.00005) {
      map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
};

const FitBounds = ({ routeCoords, pickup, destination }: any) => {
  const map = useMapEvents({});
  useEffect(() => {
    if (routeCoords && routeCoords.length > 0) {
      map.fitBounds(L.latLngBounds(routeCoords), { 
        paddingTopLeft: [40, 40], 
        paddingBottomRight: [40, 420], // High bottom padding to keep route in top 40% of screen
        animate: true 
      });
    } else if (pickup && destination) {
       map.fitBounds([
         [pickup.lat, pickup.lng],
         [destination.lat, destination.lng]
       ], { 
         paddingTopLeft: [40, 40], 
         paddingBottomRight: [40, 420], 
         animate: true 
       });
    }
  }, [routeCoords, pickup, destination, map]);
  return null;
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MapComponent() {
  const mapCenter = useLocationStore((state) => state.mapCenter);
  const isReverseGeocoding = useLocationStore((state) => state.isReverseGeocoding);
  const uiState = useLocationStore((state) => state.uiState);

  const [isMounted, setIsMounted] = useState(false);
  const [icons, setIcons] = useState<{ pickup: L.DivIcon; dest: L.DivIcon; car: L.DivIcon } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    
    const createIcon = (color: string) => L.divIcon({
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
      className: 'custom-leaflet-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    setIcons({
      pickup: createIcon('#00b14f'),
      dest: createIcon('#3b82f6'),
      car: L.divIcon({
        html: carIconHTML,
        className: 'custom-car-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      })
    });
  }, []);

  const [initialCenter] = useState<{ lat: number; lng: number }>(() => 
    mapCenter || { lat: 10.7711, lng: 106.7042 } // Fallback to Bitexco only if GPS is slow
  );

  if (!isMounted || !icons || !mapCenter) return (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-gray-400 text-sm">
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-medium text-gray-600">Đang xác định vị trí của bạn...</p>
        <p className="text-xs text-gray-400 max-w-[200px]">Vui lòng cho phép quyền truy cập GPS để sử dụng ứng dụng.</p>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100">
      <MapContainer
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={16}
        ref={(m) => { if (m) (window as any)._passengerMap = m; }}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <MapLayers icons={icons} initialCenter={initialCenter} />
      </MapContainer>

      {/* Recenter Button Overlay - Smaller and moved lower */}
      <div className="absolute top-36 right-4 z-[1000]">
          <button 
            onClick={() => {
              if (!navigator.geolocation) return;
              const map = (window as any)._passengerMap;
              if (!map) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  map.setView([pos.coords.latitude, pos.coords.longitude], 17, { animate: true });
                },
                () => {
                  // Fallback to mapCenter if GPS fails
                  if (mapCenter) map.setView([mapCenter.lat, mapCenter.lng], 17, { animate: true });
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
              );
            }}
            className="bg-white p-2 rounded-full shadow-lg border border-gray-100 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all pointer-events-auto"
            title="Quay về vị trí của tôi"
          >
            <LocateFixed size={18} className="text-emerald-600" />
          </button>
      </div>

      {uiState === 'map' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-20 pointer-events-none">
          <div className={`transition-transform duration-200 ${isReverseGeocoding ? '-translate-y-4 opacity-70 scale-95' : 'translate-y-0 scale-100 opacity-100'}`}>
            <div className="relative flex flex-col items-center">
              {/* Pin SVG — classic Google Maps style */}
              <svg width="32" height="42" viewBox="0 0 44 58" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)]">
                <path
                  d="M22 0C10.4 0 1 9.4 1 21C1 36.5 22 58 22 58C22 58 43 36.5 43 21C43 9.4 33.6 0 22 0Z"
                  fill="#E53935"
                />
                {/* Dark center dot */}
                <circle cx="22" cy="21" r="8" fill="#B71C1C" />
              </svg>
              {/* Ground shadow ellipse */}
              <div className="w-4 h-1.5 bg-black/25 rounded-full blur-[2px] -mt-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
