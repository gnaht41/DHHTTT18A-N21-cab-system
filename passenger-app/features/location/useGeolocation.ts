import { useEffect, useState } from 'react';
import { useLocationStore } from '@/store/location.store';
import { GeocodeService } from '@/services/geocode.service';

export const useGeolocation = () => {
  const [error, setError] = useState<string | null>(null);
  const setPickup = useLocationStore((state) => state.setPickup);
  const setMapCenter = useLocationStore((state) => state.setMapCenter);
  const setIsReverseGeocoding = useLocationStore((state) => state.setIsReverseGeocoding);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsReverseGeocoding(true);

    const MAX_ACCURACY_M = 3000; // Reject if accuracy > 3km (IP-based geolocation)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // Reject wildly inaccurate positions (e.g., IP-based that puts you in Hanoi)
        if (accuracy > MAX_ACCURACY_M) {
          console.warn(`[GPS] Poor accuracy: ${Math.round(accuracy)}m — waiting for better fix`);
          setError(`Tín hiệu GPS yếu (${Math.round(accuracy / 1000)}km). Đang chờ định vị chính xác hơn...`);
          setIsReverseGeocoding(false);
          return;
        }

        setMapCenter({ lat: latitude, lng: longitude });
        const geocodeResult = await GeocodeService.reverseGeocode(latitude, longitude);
        if (geocodeResult) {
          setPickup(geocodeResult);
        } else {
          setError('Không thể lấy địa chỉ, vui lòng thử lại.');
        }
        setIsReverseGeocoding(false);
      },
      (geoError) => {
        console.warn('Geolocation Error:', geoError.message);
        setError('Không thể lấy vị trí. Vui lòng cho phép quyền GPS trong trình duyệt.');
        setIsReverseGeocoding(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 30000, 
        maximumAge: 0 
      }
    );
  }, [setPickup, setMapCenter, setIsReverseGeocoding]);

  return { error };
};
