export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
  name: string;
}

export const GeocodeService = {
  reverseGeocode: async (lat: number, lng: number): Promise<GeocodeResult | null> => {
    try {
      const response = await fetch(`/api/geocode?type=reverse&lat=${lat}&lng=${lng}`);
      
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.address) {
         throw new Error('Invalid data format from geocode API');
      }

      const addressParts = [];
      if (data.address.road) addressParts.push(data.address.road);
      if (data.address.suburb) addressParts.push(data.address.suburb);
      if (data.address.city || data.address.town || data.address.village) {
        addressParts.push(data.address.city || data.address.town || data.address.village);
      }
      
      const fullAddress = addressParts.join(', ') || data.display_name;
      const name = data.address.road || data.name || addressParts[0] || 'Unknown Location';

      return {
        lat,
        lng,
        address: fullAddress,
        name,
      };
    } catch (error) {
      console.error('Reverse geocode error:', error);
      // Fallback: Return raw coordinates to keep app functional
      return {
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        name: 'Vị trí hiện tại',
      };
    }
  },

  searchAddress: async (query: string, viewbox?: string): Promise<GeocodeResult[]> => {
    if (!query || query.length < 2) return [];
    try {
      let url = `/api/geocode?type=search&q=${encodeURIComponent(query)}`;
      if (viewbox) {
        url += `&viewbox=${viewbox}&bounded=1`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      if (!Array.isArray(data)) return [];

      return data.map((item: any) => {
        const addressParts = [];
        if (item.address?.road) addressParts.push(item.address.road);
        if (item.address?.suburb) addressParts.push(item.address.suburb);
        if (item.address?.city || item.address?.town) {
          addressParts.push(item.address.city || item.address.town);
        }
        
        return {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          address: item.display_name,
          name: item.name || addressParts[0] || item.display_name.split(',')[0],
        };
      });
    } catch (error) {
      console.error('Search address error:', error);
      return [];
    }
  },

  searchNearby: async (lat: number, lng: number): Promise<GeocodeResult[]> => {
    try {
      const delta = 0.02; // roughly 2km
      const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
      
      const categories = ['restaurant', 'cafe', 'hospital', 'school', 'market', 'mall'];
      const randomCategories = categories.sort(() => 0.5 - Math.random()).slice(0, 3);
      
      const allResults: GeocodeResult[] = [];
      
      for (const category of randomCategories) {
        const response = await fetch(
          `/api/geocode?type=search&q=${category}&viewbox=${viewbox}&bounded=1`
        );
        if (!response.ok) continue;
        const data = await response.json();
        
        if (Array.isArray(data)) {
          for (const item of data) {
            allResults.push({
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              address: item.display_name,
              name: item.name || item.display_name.split(',')[0],
            });
          }
        }
        // Small delay to be respectful even via proxy
        await new Promise(r => setTimeout(r, 300));
      }
      
      return allResults;
    } catch (error) {
      console.error('Nearby search error:', error);
      return [];
    }
  }
};
