/**
 * Fetches routing geometry (Polyline coordinates) from OSRM mapping service.
 * Returns an object with the distance, duration, and geojson coordinate array.
 */
class RoutingService {
  async getRoute(pickup, destination) {
    try {
      // Mock geocoding: In a real system, we'd use a Geocoder (like Nominatim)
      // to convert pickup/destination strings to coordinates.
      // For this simulation, we'll randomize start and end points slightly
      // around a central area (e.g., New York City).
      
      const pLat = 40.7128 + (Math.random() - 0.5) * 0.05;
      const pLng = -74.0060 + (Math.random() - 0.5) * 0.05;
      const dLat = pLat + (Math.random() - 0.5) * 0.05;
      const dLng = pLng + (Math.random() - 0.5) * 0.05;

      const pStr = `${pLng},${pLat}`;
      const dStr = `${dLng},${dLat}`;

      const url = `https://router.project-osrm.org/route/v1/driving/${pStr};${dStr}?overview=full&geometries=geojson`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch route: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distance = route.distance; // meters
        const duration = route.duration; // seconds
        
        // Coordinates from OSRM are [lng, lat], let's map them to [lat, lng]
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        return {
          coordinates,
          distance,
          duration,
          pickupCoords: coordinates[0],
          destinationCoords: coordinates[coordinates.length - 1]
        };
      }
      
      return null;
    } catch (error) {
      console.error('[RoutingService] Error fetching route:', error.message);
      return null;
    }
  }
}

module.exports = new RoutingService();
