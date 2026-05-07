import { GeocodeResult } from './geocode.service';

export const RoutingService = {
  getRoute: async (pickup: GeocodeResult, destination: GeocodeResult): Promise<{ coords: [number, number][]; distanceKm: number }> => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
      );

      if (!response.ok) throw new Error('Failed to fetch route');

      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = data.routes[0];
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10; // meters → km, 1 decimal
      const coords: [number, number][] = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
      
      return { coords, distanceKm };
    } catch (error) {
      console.error('Error fetching route:', error);
      return { coords: [], distanceKm: 0 };
    }
  }
};
