"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { BottomSheet } from '@/components/BottomSheet';
import { ProfilePanel } from '@/components/ProfilePanel';
import { useGeolocation } from '@/features/location/useGeolocation';
import { useReverseGeocode } from '@/features/location/useReverseGeocode';
import { useLocationStore } from '@/store/location.store';
import { useAuthStore } from '@/store/auth.store';
import { connectSocket } from '@/services/socket';
import { ChevronLeft, User } from 'lucide-react';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-gray-400 text-sm">
      Loading Map...
    </div>
  )
});

export default function Home() {
  useGeolocation();
  useReverseGeocode();

  const user = useAuthStore((state) => state.user);
  const userProfile = useLocationStore((state) => state.userProfile);
  const uiState = useLocationStore((state) => state.uiState);
  const setUiState = useLocationStore((state) => state.setUiState);
  const setDestination = useLocationStore((state) => state.setDestination);
  const setRouteCoordinates = useLocationStore((state) => state.setRouteCoordinates);
  const setDriverLocation = useLocationStore((state) => state.setDriverLocation);
  const setDriverDetails = useLocationStore((state) => state.setDriverDetails);
  const initializeSocketListeners = useLocationStore((state) => state.initializeSocketListeners);

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      const socket = connectSocket(user.id, 'passenger');
      initializeSocketListeners(String(user.id));
      
      return () => {
        socket.disconnect();
      };
    }
  }, [user, initializeSocketListeners]);

  const handleBack = () => {
    if (['confirm', 'finding_driver'].includes(uiState)) {
      setUiState('map');
      setDestination(null);
      setRouteCoordinates(null);
      setDriverLocation(null);
      setDriverDetails(null);
    }
  };

  const showHeader = ['map', 'confirm', 'finding_driver', 'search'].includes(uiState);

  return (
    <>

        {/* Top Header Layer */}
        {showHeader && (
          <div className="absolute top-0 w-full z-40 p-4 pt-12 flex justify-between items-start pointer-events-none">

            {/* Left: Profile Avatar or Back Button */}
            <div className="pointer-events-auto">
              {['map', 'search'].includes(uiState) ? (
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="bg-white/90 backdrop-blur-sm p-2.5 rounded-full shadow-md flex items-center gap-2 pr-4 transition-transform active:scale-95"
                >
                  <div className="w-8 h-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    {(userProfile.name || user?.name || 'User').split(' ').pop()}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleBack}
                  className="bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-md text-gray-700 hover:text-gray-900 active:scale-95 transition-transform"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Right: App badge */}
            {['map', 'search'].includes(uiState) && (
              <div className="pointer-events-auto bg-white/90 backdrop-blur-sm px-5 py-2 rounded-full shadow-md">
                <h1 className="font-bold text-gray-800 tracking-tight flex items-center">
                  <span className="text-[var(--color-primary)] mr-1">Rider</span> App
                </h1>
              </div>
            )}
          </div>
        )}

        {/* Map */}
        <MapComponent />

        {/* Bottom sheet / All flows */}
        <BottomSheet />

        {/* Profile Side Panel */}
        <ProfilePanel isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
