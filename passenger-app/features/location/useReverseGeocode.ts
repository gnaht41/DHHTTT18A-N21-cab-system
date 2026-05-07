import { useEffect } from 'react';
import { useLocationStore } from '@/store/location.store';
import { GeocodeService } from '@/services/geocode.service';
import { useDebounce } from 'use-debounce';

export const useReverseGeocode = () => {
  const mapCenter = useLocationStore((state) => state.mapCenter);
  const setPickup = useLocationStore((state) => state.setPickup);
  const setIsReverseGeocoding = useLocationStore((state) => state.setIsReverseGeocoding);
  const uiState = useLocationStore((state) => state.uiState);

  // Debounce the map center coordinates by 800ms
  const [debouncedCenter] = useDebounce(mapCenter, 800);

  useEffect(() => {
    // Only fetch if we're actively picking a location on the map
    if (uiState !== 'map' || !debouncedCenter) return;

    const fetchAddress = async () => {
      setIsReverseGeocoding(true);
      const result = await GeocodeService.reverseGeocode(
        debouncedCenter.lat,
        debouncedCenter.lng
      );
      
      if (result) {
        setPickup(result);
      }
      setIsReverseGeocoding(false);
    };

    fetchAddress();
  }, [debouncedCenter, uiState, setPickup, setIsReverseGeocoding]);
};
