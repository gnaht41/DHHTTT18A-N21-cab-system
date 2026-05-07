"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useLocationStore } from '@/store/location.store';
import { AddressCard } from './AddressCard';
import { SearchInput } from './SearchInput';
import { RoutingService } from '@/services/routing.service';
import { PaymentSheet, PaymentDoneSheet } from './PaymentSheet';
import { ReviewSheet } from './ReviewSheet';
import { VehicleSelector, calculateFare } from './VehicleSelector';
import { Car, Star, ShieldCheck, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

export function BottomSheet() {
  const uiState = useLocationStore((state) => state.uiState);
  const setUiState = useLocationStore((state) => state.setUiState);
  
  const pickup = useLocationStore((state) => state.pickup);
  const destination = useLocationStore((state) => state.destination);
  const isReverseGeocoding = useLocationStore((state) => state.isReverseGeocoding);
  
  const setRouteCoordinates = useLocationStore((state) => state.setRouteCoordinates);
  const driverDetails = useLocationStore((state) => state.driverDetails);
  const setDriverDetails = useLocationStore((state) => state.setDriverDetails);
  const setDriverLocation = useLocationStore((state) => state.setDriverLocation);
  const setDistanceKm = useLocationStore((state) => state.setDistanceKm);
  const setFare = useLocationStore((state) => state.setFare);
  const distanceKm = useLocationStore((state) => state.distanceKm);
  const vehicleType = useLocationStore((state) => state.vehicleType);
  const createBooking = useLocationStore((state) => state.createBooking);
  const setSearchType = useLocationStore((state) => state.setSearchType);

  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  // Auto-fetch route whenever destination is set in confirm mode
  useEffect(() => {
    if (uiState === 'confirm' && pickup && destination) {
      setIsLoadingRoute(true);
      RoutingService.getRoute(pickup, destination).then(({ coords, distanceKm: km }) => {
        setRouteCoordinates(coords);
        setDistanceKm(km);
        setFare(calculateFare(vehicleType, km));
        setIsLoadingRoute(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState, destination, pickup]);

  const handleConfirmRide = async () => {
    await createBooking();
  };

  const resetApp = () => {
    setUiState('map');
    useLocationStore.getState().setDestination(null as any);
    setRouteCoordinates(null);
    setDriverLocation(null);
    setDriverDetails(null);
  }

  return (
    <AnimatePresence mode="wait">
      {/* Search Full Screen Sheet Overlay */}
      {uiState === 'search' && (
        <motion.div
          key="search-sheet"
          initial={{ y: '100%' }}
          animate={{ y: '0%' }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute inset-x-0 bottom-0 z-[1100] pointer-events-none flex flex-col justify-end"
        >
          {/* Transparent area above sheet to allow clicking map/profile */}
          <div className="flex-1 pointer-events-auto h-[50vh] w-full" onClick={() => setUiState('map')} />
          
          <div className="relative w-full h-[50vh] bg-white rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.2)] pointer-events-auto flex flex-col overflow-hidden">
            <SearchInput />
          </div>
        </motion.div>
      )}

      {/* Main Bottom Card Wrapper */}
      {!['search', 'payment', 'payment_done', 'reviewed'].includes(uiState) && (
        <motion.div
          key="main-card-wrapper"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute bottom-0 w-full z-[1050] p-4 pb-8 pointer-events-none flex flex-col justify-end max-h-full"
        >
          <div className="bg-white/95 backdrop-blur-md shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.15)] rounded-2xl p-4 w-full flex flex-col gap-3 pointer-events-auto max-h-[75vh] overflow-y-auto overflow-x-hidden">
            
            {(uiState === 'map' || uiState === 'confirm') && (
              <>
                <AddressCard 
                  type="pickup"
                  label="Pickup Location"
                  address={pickup?.name ? `${pickup.name} - ${pickup.address}` : ''}
                  isLoading={isReverseGeocoding}
                  onClick={() => {
                    setSearchType('pickup');
                    setUiState('search');
                  }}
                />
                
                {uiState === 'confirm' && destination && (
                  <>
                    <AddressCard 
                      type="destination"
                      label="Destination"
                      address={destination.name ? `${destination.name} - ${destination.address}` : ''}
                      isLoading={false}
                      onClick={() => {
                        setSearchType('destination');
                        setUiState('search');
                      }}
                    />
                    {/* Vehicle Selector */}
                    {isLoadingRoute ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
                        <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Đang tính tuyến đường...</span>
                      </div>
                    ) : (
                      <VehicleSelector distanceKm={distanceKm} />
                    )}
                    <button 
                      onClick={handleConfirmRide}
                      disabled={isLoadingRoute}
                      className="w-full mt-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-60 active:scale-[0.98] transition-all text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/30"
                    >
                      Đặt xe ngay
                    </button>
                  </>
                )}

                {uiState === 'map' && (
                  <button
                    onClick={() => {
                      setSearchType('destination');
                      setUiState('search');
                    }}
                    className="w-full mt-1 flex items-center gap-3 bg-gray-50 border-2 border-gray-200 hover:border-[var(--color-primary)] active:scale-[0.98] transition-all py-3.5 px-4 rounded-2xl group"
                  >
                    <div className="w-8 h-8 bg-[var(--color-primary)]/10 group-hover:bg-[var(--color-primary)]/20 rounded-xl flex items-center justify-center transition-colors shrink-0">
                      <Search className="w-4 h-4 text-[var(--color-primary)]" />
                    </div>
                    <span className="flex-1 text-left text-gray-400 font-medium">Where to?</span>
                    <div className="bg-[var(--color-primary)] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm shadow-green-400/30">
                      Go
                    </div>
                  </button>
                )}
              </>
            )}

            {uiState === 'finding_driver' && (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="relative mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-[var(--color-primary)] rounded-full"
                  />
                  <div className="relative bg-white p-4 rounded-full shadow-lg border-2 border-[var(--color-primary)]/20">
                    <Car className="w-10 h-10 text-[var(--color-primary)]" />
                  </div>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-8px] border-2 border-dashed border-[var(--color-primary)]/40 rounded-full"
                  />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Finding your driver...</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-[200px]">We're notifying the closest drivers to your location</p>
                <div className="mt-8 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-1/2 h-full bg-[var(--color-primary)] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                  />
                </div>
              </div>
            )}

            {(uiState === 'driver_on_way' || uiState === 'driver_arrived' || uiState === 'riding') && driverDetails && (
              <div className="flex flex-col gap-4 py-2">
                <div className="flex justify-between items-start">
                   <div>
                      <h3 className={`text-xl font-bold ${uiState === 'driver_arrived' ? 'text-[var(--color-primary)]' : 'text-gray-900'}`}>
                        {uiState === 'driver_on_way' ? 'Driver is arriving' : 
                         uiState === 'driver_arrived' ? 'Driver is here!' :
                         'Driving to destination'}
                      </h3>
                      <p className="text-sm text-[var(--color-primary)] font-semibold mt-1">
                        {uiState === 'driver_on_way' ? `ETA: ${driverDetails.eta} mins` : 
                         uiState === 'driver_arrived' ? 'Meet at the pickup point' :
                         'On route'}
                      </p>
                   </div>
                   <motion.div 
                     animate={uiState === 'driver_arrived' ? { scale: [1, 1.05, 1] } : {}}
                     transition={{ duration: 0.8, repeat: Infinity }}
                     className={`px-3 py-1 rounded-lg border text-center ${uiState === 'driver_arrived' ? 'bg-green-100 border-green-200 shadow-sm' : 'bg-orange-100 border-orange-200'}`}
                   >
                     <span className={`block text-[10px] uppercase font-bold tracking-wider ${uiState === 'driver_arrived' ? 'text-green-700' : 'text-orange-600'}`}>License</span>
                     <span className="block font-bold text-gray-900">{driverDetails.plate}</span>
                   </motion.div>
                </div>

                <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden shrink-0 relative">
                     {/* Mock Driver Avatar */}
                     <Car className="w-6 h-6 text-gray-500" />
                  </div>
                  <div className="flex-1">
                     <p className="font-bold text-gray-900 flex items-center">
                       {driverDetails.name} <Star className="w-4 h-4 text-yellow-500 ml-2 inline fill-yellow-500" /> <span className="text-sm font-medium ml-1">{driverDetails.rating}</span>
                     </p>
                     <p className="text-sm text-gray-500">{driverDetails.vehicle}</p>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-[var(--color-primary)]" />
                </div>
              </div>
            )}

            {uiState === 'arrived' && (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">You&apos;ve arrived!</h3>
                <p className="text-sm text-gray-500 mt-2 mb-2">Preparing your payment...</p>
              </div>
            )}
            
          </div>
        </motion.div>
      )}

      {/* Payment Flow */}
      {uiState === 'payment' && <PaymentSheet key="payment-sheet" />}
      {uiState === 'payment_done' && <PaymentDoneSheet key="payment-done-sheet" />}
      {uiState === 'reviewed' && <ReviewSheet key="review-sheet" />}

    </AnimatePresence>
  );
}
