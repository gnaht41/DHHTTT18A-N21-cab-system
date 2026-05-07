"use client";

import { useEffect, useRef, useState } from 'react';
import { useSearchPlace } from '@/features/location/useSearchPlace';
import { useLocationStore } from '@/store/location.store';
import { GeocodeService, GeocodeResult } from '@/services/geocode.service';
import { MapPin, Search as SearchIcon, X, Loader2, Clock, Coffee, ShoppingBag, GraduationCap, Hospital, Building2 } from 'lucide-react';



export function SearchInput() {
  const setDestination = useLocationStore((state) => state.setDestination);
  const setPickup = useLocationStore((state) => state.setPickup);
  const setMapCenter = useLocationStore((state) => state.setMapCenter);
  const setUiState = useLocationStore((state) => state.setUiState);
  const pickup = useLocationStore((state) => state.pickup);
  const searchType = useLocationStore((state) => state.searchType);
  const destination = useLocationStore((state) => state.destination);
  
  const { query, setQuery, results, isLoading, setResults } = useSearchPlace(pickup);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<GeocodeResult[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Fetch nearby suggestions on mount
    if (pickup) {
      setIsLoadingNearby(true);
      GeocodeService.searchNearby(pickup.lat, pickup.lng)
        .then((places) => {
          setNearbyPlaces(places);
          setIsLoadingNearby(false);
        })
        .catch(() => setIsLoadingNearby(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (place: GeocodeResult) => {
    if (searchType === 'pickup') {
      setPickup({
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        name: place.name
      });
      setMapCenter({ lat: place.lat, lng: place.lng });
      // If destination already set, go to confirm. Otherwise go back to map.
      setUiState(destination ? 'confirm' : 'map');
    } else {
      setDestination({
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        name: place.name
      });
      setMapCenter({ lat: place.lat, lng: place.lng });
      setUiState('confirm');
    }
    setQuery('');
    setResults([]);
  };

  const handleCategorySearch = (categoryQuery: string) => {
    setQuery(categoryQuery);
  };

  const showNearby = !query && nearbyPlaces.length > 0;
  const showCategories = !query;

  return (
    <div className="flex flex-col h-full bg-white rounded-t-3xl pt-2">
      <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
      
      <div className="px-5 pb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {searchType === 'pickup' ? 'Nhập điểm đón' : 'Bạn muốn đi đâu?'}
          </h2>
          <button 
            onClick={() => setUiState('map')}
            className="text-sm font-medium text-[var(--color-primary)] px-3 py-1 hover:bg-green-50 rounded-lg transition-colors"
          >
            Hủy
          </button>
        </div>
        
        <div className="flex flex-col gap-3 mb-4">
          {/* Pickup Readonly Row */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 opacity-80 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
               <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Điểm đón</p>
              <p className="text-sm font-medium text-gray-600 truncate">{pickup?.name || pickup?.address || 'Chọn điểm đón'}</p>
            </div>
          </div>

          {/* Destination Search Row */}
          <div className="relative flex items-center bg-gray-100 rounded-xl px-4 py-3 border border-gray-200 focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] transition-all">
            <SearchIcon className="text-gray-400 w-5 h-5 mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-base"
              placeholder={searchType === 'pickup' ? "Tìm địa chỉ đón..." : "Tìm điểm đến..."}
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 rounded-full hover:bg-gray-200 ml-2">
                <X className="text-gray-500 w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 w-full">
        

        {/* Nearby Suggestions (shown when no query typed) */}
        {showNearby && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Địa điểm gần bạn</p>
            {nearbyPlaces.map((place, index) => (
              <div 
                key={`nearby-${index}`}
                className="flex items-center gap-4 py-3.5 border-b border-gray-100 last:border-none cursor-pointer active:bg-gray-50 rounded-lg"
                onClick={() => handleSelect(place)}
              >
                <div className="bg-blue-50 p-2.5 rounded-full shrink-0">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{place.name}</p>
                  <p className="text-sm text-gray-500 truncate">{place.address}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoadingNearby && !query && (
          <div className="flex justify-center items-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="ml-2 text-sm">Finding nearby places...</span>
          </div>
        )}

        {/* Search Results (shown when query is typed) */}
        {isLoading && (
          <div className="flex justify-center items-center py-8 text-[var(--color-primary)]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2 text-sm font-medium">Searching...</span>
          </div>
        )}
        
        {!isLoading && query && results.map((place, index) => (
          <div 
            key={index}
            className="flex items-center gap-4 py-3.5 border-b border-gray-100 last:border-none cursor-pointer active:bg-gray-50 rounded-lg"
            onClick={() => handleSelect(place)}
          >
            <div className="bg-gray-100 p-2.5 rounded-full shrink-0">
              <MapPin className="w-5 h-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{place.name}</p>
              <p className="text-sm text-gray-500 truncate">{place.address}</p>
            </div>
          </div>
        ))}
        
        {!isLoading && query.length >= 2 && results.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No results found for &quot;{query}&quot;.
          </div>
        )}
      </div>
    </div>
  );
}

