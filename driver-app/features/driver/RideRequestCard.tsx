"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDriverStore } from '@/store/driver.store';
import { RoutingService } from '@/services/driver.mock';
import { MapPin, Navigation, Star, Clock, DollarSign, X, Check } from 'lucide-react';

const COUNTDOWN_SECONDS = 15;

export function RideRequestCard() {
  const rideStatus = useDriverStore((s) => s.rideStatus);
  const currentRide = useDriverStore((s) => s.currentRide);
  const driverLocation = useDriverStore((s) => s.driverLocation);
  const acceptRide = useDriverStore((s) => s.acceptRide);
  const rejectRide = useDriverStore((s) => s.rejectRide);
  const setRouteCoordinates = useDriverStore((s) => s.setRouteCoordinates);

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isVisible = rideStatus === 'REQUESTED' && !!currentRide;

  // Countdown timer
  useEffect(() => {
    if (!isVisible) {
      setCountdown(COUNTDOWN_SECONDS);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setCountdown(COUNTDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          rejectRide(); // auto-reject on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isVisible, rejectRide]);

  const handleAccept = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    acceptRide();

    // Fetch route: driver → pickup
    if (driverLocation && currentRide) {
      const driverGeo = {
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        address: 'Driver',
        name: 'Driver',
      };
      const route = await RoutingService.getRoute(driverGeo, currentRide.pickup);
      setRouteCoordinates(route);
    }
  };

  const handleReject = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    rejectRide();
  };

  const progress = (countdown / COUNTDOWN_SECONDS) * 100;
  const circumference = 2 * Math.PI * 30; // r=30
  const strokeDashoffset = circumference * (1 - progress / 100);

  return (
    <AnimatePresence>
      {isVisible && currentRide && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 z-40"
          />

          {/* Card */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-white px-5 pt-6 pb-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em] mb-1.5">
                    New Ride Request
                  </p>
                  <h2 className="text-slate-900 text-2xl font-black tracking-tight">{currentRide.passenger.name}</h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Star size={14} className="text-amber-500 fill-amber-500" />
                    <span className="text-slate-500 text-sm font-bold">{currentRide.passenger.rating}</span>
                  </div>
                </div>

                {/* Countdown ring */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg width="68" height="68" className="absolute inset-0 -rotate-90">
                    <circle cx="34" cy="34" r="30" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="4" />
                    <circle
                      cx="34"
                      cy="34"
                      r="30"
                      fill="none"
                      stroke="#00b14f"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                  </svg>
                  <span className="text-slate-900 text-2xl font-black relative z-10">{countdown}</span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="bg-white px-5 py-6 flex flex-col gap-5">
              {/* Pickup */}
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={18} className="text-[var(--color-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pickup</p>
                  <p className="text-base font-bold text-slate-900 leading-tight">
                    {currentRide.pickup.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{currentRide.pickup.address}</p>
                </div>
              </div>

              {/* Destination */}
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Navigation size={18} className="text-[var(--color-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Destination</p>
                  <p className="text-base font-bold text-slate-900 leading-tight">
                    {currentRide.destination.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{currentRide.destination.address}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="text-center">
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5">Distance</p>
                  <p className="text-lg font-black text-slate-900">{currentRide.distanceKm} km</p>
                </div>
                <div className="text-center border-x border-gray-200">
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5">ETA</p>
                  <p className="text-lg font-black text-slate-900">{currentRide.etaMinutes} m</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5">Fare</p>
                  <p className="text-lg font-black text-[var(--color-primary)]">
                    {(currentRide.fare / 1000).toFixed(0)}k
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <motion.button
                  id="reject-ride-btn"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReject}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-100 text-slate-600 font-black text-sm uppercase tracking-wider border border-gray-100 active:bg-gray-200"
                >
                  <X size={20} strokeWidth={3} />
                  Reject
                </motion.button>
                <motion.button
                  id="accept-ride-btn"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAccept}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-[var(--color-primary)] text-white font-black text-sm uppercase tracking-wider shadow-2xl shadow-green-500/20 active:bg-green-600"
                >
                  <Check size={20} strokeWidth={3} />
                  Accept
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
