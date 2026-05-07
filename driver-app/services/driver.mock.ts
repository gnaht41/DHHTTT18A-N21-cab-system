import { GeocodeResult, RideRequest } from '@/store/driver.store';

// ─── Geocode Service (copied from passenger-app) ──────────────────────────────

export const GeocodeService = {
  reverseGeocode: async (lat: number, lng: number): Promise<GeocodeResult | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'DriverCabApp/1.0',
          },
        }
      );
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();

      const parts: string[] = [];
      if (data.address.road) parts.push(data.address.road);
      if (data.address.suburb) parts.push(data.address.suburb);
      if (data.address.city || data.address.town || data.address.village)
        parts.push(data.address.city || data.address.town || data.address.village);

      return {
        lat,
        lng,
        address: parts.join(', ') || data.display_name,
        name: data.address.road || data.name || parts[0] || 'Unknown',
      };
    } catch {
      return null;
    }
  },
};

// ─── Routing Service ──────────────────────────────────────────────────────────

export const RoutingService = {
  getRoute: async (from: GeocodeResult, to: GeocodeResult): Promise<[number, number][]> => {
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
      );
      if (!res.ok) throw new Error('Route fetch failed');
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route');
      return data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
    } catch {
      return [];
    }
  },
};

// ─── Mock ride data ───────────────────────────────────────────────────────────

const PASSENGER_NAMES = [
  'Nguyen Thi Lan', 'Tran Minh Khoa', 'Le Thi Hong', 'Pham Van Cuong',
  'Hoang Thi Mai', 'Bui Quoc Hung', 'Vo Thi Thu', 'Dang Van Nam',
];
const PASSENGER_RATINGS = ['4.5', '4.7', '4.8', '4.9', '5.0', '4.6', '4.3'];

function randomOffset(base: number, min: number, max: number): number {
  const sign = Math.random() > 0.5 ? 1 : -1;
  return base + sign * (min + Math.random() * (max - min));
}

export async function generateRideRequest(
  driverLat: number,
  driverLng: number
): Promise<RideRequest | null> {
  // Pickup: 0.3–1 km away from driver
  const pickupLat = randomOffset(driverLat, 0.003, 0.01);
  const pickupLng = randomOffset(driverLng, 0.003, 0.01);

  // Destination: 1–5 km away from pickup
  const destLat = randomOffset(pickupLat, 0.01, 0.05);
  const destLng = randomOffset(pickupLng, 0.01, 0.05);

  const [pickupGeo, destGeo] = await Promise.all([
    GeocodeService.reverseGeocode(pickupLat, pickupLng),
    GeocodeService.reverseGeocode(destLat, destLng),
  ]);

  if (!pickupGeo || !destGeo) return null;

  // Rough distance + fare estimate
  const dlat = Math.abs(destLat - pickupLat);
  const dlng = Math.abs(destLng - pickupLng);
  const distanceKm = Math.round((dlat + dlng) * 111 * 10) / 10;
  const fare = Math.round((15000 + distanceKm * 5000) / 1000) * 1000;
  const etaMinutes = Math.ceil(distanceKm * 2);

  return {
    id: `ride-${Date.now()}`,
    passenger: {
      name: PASSENGER_NAMES[Math.floor(Math.random() * PASSENGER_NAMES.length)],
      rating: PASSENGER_RATINGS[Math.floor(Math.random() * PASSENGER_RATINGS.length)],
    },
    pickup: pickupGeo,
    destination: destGeo,
    distanceKm,
    etaMinutes,
    fare,
  };
}

// ─── Simulation controller ────────────────────────────────────────────────────

let simTimer: ReturnType<typeof setTimeout> | null = null;

export function startRideSimulation(
  driverLat: number,
  driverLng: number,
  onRequest: (req: RideRequest) => void
) {
  stopRideSimulation();
  const delay = 6000 + Math.random() * 6000; // 6–12 s
  simTimer = setTimeout(async () => {
    const req = await generateRideRequest(driverLat, driverLng);
    if (req) onRequest(req);
  }, delay);
}

export function stopRideSimulation() {
  if (simTimer) {
    clearTimeout(simTimer);
    simTimer = null;
  }
}
