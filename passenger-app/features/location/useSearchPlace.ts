import { useState, useEffect } from 'react';
import { GeocodeService, GeocodeResult } from '@/services/geocode.service';
import { useDebounce } from 'use-debounce';

export const useSearchPlace = (centerCoords?: { lat: number, lng: number } | null) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 500);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      let viewbox;
      if (centerCoords) {
        // ~5km radius bounding box around centerCoords
        const delta = 0.05;
        viewbox = `${centerCoords.lng - delta},${centerCoords.lat + delta},${centerCoords.lng + delta},${centerCoords.lat - delta}`;
      }
      const data = await GeocodeService.searchAddress(debouncedQuery, viewbox);
      setResults(data);
      setIsLoading(false);
    };

    search();
  }, [debouncedQuery, centerCoords?.lat, centerCoords?.lng]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    setResults
  };
};
