"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useDriverStore } from '@/store/driver.store';
import { RoutingService } from '@/services/driver.mock';
import {
  MapPin, Navigation, CheckCircle, User, Car, Star,
  ChevronRight, UserCheck, Clock, AlertTriangle, XCircle,
} from 'lucide-react';
import { useState } from 'react';

// ── Cancel confirmation sub-component ─────────────────────────────────────────

function CancelButton({ onCancel }: { onCancel: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button
          className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-bold"
          onClick={() => setConfirming(false)}
        >
          Keep Ride
        </button>
        <button
          id="confirm-cancel-btn"
          className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold"
          onClick={onCancel}
        >
          Yes, Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      id="cancel-ride-btn"
      className="w-full py-3 rounded-xl border border-red-200 text-red-500 text-sm font-semibold flex items-center justify-center gap-2"
      onClick={() => setConfirming(true)}
    >
      <XCircle size={16} />
      Cancel Ride
    </button>
  );
}

// ── Main TripPanel ─────────────────────────────────────────────────────────────

export function TripPanel() {
  const rideStatus = useDriverStore((s) => s.rideStatus);
  const currentRide = useDriverStore((s) => s.currentRide);
  const driverProfile = useDriverStore((s) => s.driverProfile);
  const arrivedAtPickup = useDriverStore((s) => s.arrivedAtPickup);
  const passengerBoarded = useDriverStore((s) => s.passengerBoarded);
  const completeTrip = useDriverStore((s) => s.completeTrip);
  const cancelRide = useDriverStore((s) => s.cancelRide);
  const setRouteCoordinates = useDriverStore((s) => s.setRouteCoordinates);
  const reset = useDriverStore((s) => s.reset);

  const isVisible = ['ACCEPTED', 'ARRIVED_PICKUP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(rideStatus);

  const handleArrivedPickup = () => {
    arrivedAtPickup(); // ACCEPTED → ARRIVED_PICKUP
    // Clear route on map (driver arrived, route done)
    setRouteCoordinates(null);
  };

  const handlePassengerBoarded = async () => {
    passengerBoarded(); // ARRIVED_PICKUP → IN_PROGRESS
    // Fetch route: pickup → destination
    if (currentRide) {
      const route = await RoutingService.getRoute(currentRide.pickup, currentRide.destination);
      setRouteCoordinates(route);
    }
  };

  const handleCancel = () => {
    cancelRide(); // → CANCELLED
    setRouteCoordinates(null);
  };

  return (
    <AnimatePresence>
      {isVisible && currentRide && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="absolute bottom-0 left-0 right-0 z-40 p-2 pb-6 flex flex-col justify-end max-h-full pointer-events-none"
        >
          <div className="bg-white border border-gray-100 rounded-[1.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-y-auto overflow-x-hidden max-h-[70vh] pointer-events-auto">

            {/* ══════════════════════════════════════════
                STATE 1: ACCEPTED – Heading to Pickup
            ══════════════════════════════════════════ */}
            {rideStatus === 'ACCEPTED' && (
              <div className="flex flex-col">
                {/* Header */}
                <div className="bg-[var(--color-primary)] px-4 py-2 flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Navigation size={18} className="text-white animate-pulse" strokeWidth={3} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white text-base font-black italic uppercase tracking-tight">Heading to Pickup</h3>
                  </div>
                </div>

                {/* Passenger info */}
                <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-50">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100">
                    <User size={20} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-base tracking-tight">{currentRide.passenger.name}</p>
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-amber-500 fill-amber-500" />
                      <span className="text-xs text-slate-500 font-bold">{currentRide.passenger.rating}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Fare</p>
                    <p className="text-xl font-black text-[var(--color-primary)]">
                      {(currentRide.fare / 1000).toFixed(0)}k
                    </p>
                  </div>
                </div>

                {/* Driver info */}
                <div className="px-6 py-4 flex items-start gap-4 bg-blue-50 border-b border-blue-100">
                  <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Car size={18} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Tài Xế</p>
                    <p className="text-base font-bold text-slate-900 leading-tight">{driverProfile.name || 'Driver'}</p>
                    <p className="text-xs text-slate-500 mt-1">{driverProfile.vehicle || 'Vehicle'}</p>
                    <p className="text-xs text-slate-500">Biển số: {driverProfile.plate || 'N/A'}</p>
                  </div>
                </div>

                {/* Pickup address */}
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                    <MapPin size={18} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Pickup Point</p>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{currentRide.pickup.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{currentRide.pickup.address}</p>
                  </div>
                </div>

                {/* CTAs */}
                <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
                  <motion.button
                    id="arrived-pickup-btn"
                    whileTap={{ scale: 0.97 }}
                    onClick={handleArrivedPickup}
                    className="w-full py-4 rounded-xl bg-[var(--color-primary)] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-green-500/10 flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={20} strokeWidth={3} />
                    Arrived at Pickup
                  </motion.button>
                  <CancelButton onCancel={handleCancel} />
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                STATE 2: ARRIVED_PICKUP – Waiting for Passenger
            ══════════════════════════════════════════ */}
            {rideStatus === 'ARRIVED_PICKUP' && (
              <div className="flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-[var(--color-primary)] to-green-600 px-4 py-2 flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Clock size={18} className="text-white animate-pulse" strokeWidth={3} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white text-base font-black italic uppercase tracking-tight">Waiting for Passenger</h3>
                  </div>
                </div>

                {/* Notice */}
                <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center gap-3">
                  <Car size={16} className="text-[var(--color-primary)] shrink-0" />
                  <p className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wide">
                    Waiting at pickup location
                  </p>
                </div>

                {/* Info and CTA same as above, just updating start color */}
                <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-50">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100">
                    <User size={20} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-base tracking-tight">{currentRide.passenger.name}</p>
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-amber-500 fill-amber-500" />
                      <span className="text-xs text-slate-500 font-bold">{currentRide.passenger.rating}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Fare</p>
                    <p className="text-xl font-black text-[var(--color-primary)]">
                      {(currentRide.fare / 1000).toFixed(0)}k
                    </p>
                  </div>
                </div>

                {/* Driver info */}
                <div className="px-6 py-4 flex items-start gap-4 bg-blue-50 border-b border-blue-100">
                  <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Car size={18} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Tài Xế</p>
                    <p className="text-base font-bold text-slate-900 leading-tight">{driverProfile.name || 'Driver'}</p>
                    <p className="text-xs text-slate-500 mt-1">{driverProfile.vehicle || 'Vehicle'}</p>
                    <p className="text-xs text-slate-500">Biển số: {driverProfile.plate || 'N/A'}</p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
                  <motion.button
                    id="passenger-boarded-btn"
                    whileTap={{ scale: 0.97 }}
                    onClick={handlePassengerBoarded}
                    className="w-full py-4 rounded-xl bg-[var(--color-primary)] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-green-500/10 flex items-center justify-center gap-2"
                  >
                    <UserCheck size={20} strokeWidth={3} />
                    Start Trip
                  </motion.button>
                  <CancelButton onCancel={handleCancel} />
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                STATE 3: IN_PROGRESS – Driving to Destination
            ══════════════════════════════════════════ */}
            {rideStatus === 'IN_PROGRESS' && (
              <div className="flex flex-col">
                {/* Header */}
                <div className="bg-gray-50 px-4 py-2 flex items-center gap-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Car size={18} className="text-[var(--color-primary)]" strokeWidth={3} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-slate-900 text-base font-black italic uppercase tracking-tight">Trip In Progress</h3>
                  </div>
                </div>

                {/* Passenger */}
                <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-50">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100">
                    <User size={20} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-base tracking-tight">{currentRide.passenger.name}</p>
                    <p className="text-[11px] text-slate-500 font-bold">{currentRide.distanceKm} km trip</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Est. Fare</p>
                    <p className="text-xl font-black text-[var(--color-primary)]">
                      {(currentRide.fare / 1000).toFixed(0)}k
                    </p>
                  </div>
                </div>

                {/* Driver info */}
                <div className="px-6 py-4 flex items-start gap-4 bg-blue-50 border-b border-blue-100">
                  <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Car size={18} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Tài Xế</p>
                    <p className="text-base font-bold text-slate-900 leading-tight">{driverProfile.name || 'Driver'}</p>
                    <p className="text-xs text-slate-500 mt-1">{driverProfile.vehicle || 'Vehicle'}</p>
                    <p className="text-xs text-slate-500">Biển số: {driverProfile.plate || 'N/A'}</p>
                  </div>
                </div>

                {/* Destination */}
                <div className="px-6 py-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Navigation size={18} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Destination</p>
                    <p className="text-base font-bold text-slate-900 leading-tight">{currentRide.destination.name}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{currentRide.destination.address}</p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-1">
                  <motion.button
                    id="complete-trip-btn"
                    whileTap={{ scale: 0.97 }}
                    onClick={completeTrip}
                    className="w-full py-4 rounded-xl bg-[var(--color-primary)] text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-green-500/10"
                  >
                    <CheckCircle size={20} className="inline mr-2" strokeWidth={3} />
                    Complete Trip
                  </motion.button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                STATE 4: COMPLETED – Trip Summary
            ══════════════════════════════════════════ */}
            {rideStatus === 'COMPLETED' && (
              <div className="flex flex-col items-center px-6 py-8 gap-6 bg-white">
                <div className="relative">
                  <div className="w-20 h-20 bg-[var(--color-primary)] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,177,79,0.3)]">
                    <CheckCircle size={40} className="text-white" strokeWidth={3} />
                  </div>
                </div>

                <div className="text-center">
                  <h3 className="text-2xl font-black text-slate-900 italic tracking-tight">TRIP COMPLETED!</h3>
                  <p className="text-slate-500 text-sm mt-1 uppercase font-bold tracking-widest">Great job, drive safe</p>
                </div>

                {/* Summary */}
                <div className="w-full bg-gray-50 rounded-[2rem] border border-gray-100 p-6 grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Distance</p>
                    <p className="text-xl font-black text-slate-900 italic">{currentRide.distanceKm}k</p>
                  </div>
                  <div className="text-center border-x border-gray-200">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Duration</p>
                    <p className="text-xl font-black text-slate-900 italic">{currentRide.etaMinutes}m</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Earned</p>
                    <p className="text-2xl font-black text-[var(--color-primary)] italic">
                      {(currentRide.fare / 1000).toFixed(0)}k
                    </p>
                  </div>
                </div>

                <motion.button
                  id="back-to-idle-btn"
                  whileTap={{ scale: 0.97 }}
                  onClick={reset}
                  className="w-full py-4 rounded-xl bg-[var(--color-primary)] text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-green-500/10"
                >
                  NEXT RIDE
                </motion.button>
              </div>
            )}

            {/* ══════════════════════════════════════════
                STATE 5: CANCELLED
            ══════════════════════════════════════════ */}
            {rideStatus === 'CANCELLED' && (
              <div className="flex flex-col items-center px-6 py-10 gap-6">
                <div className="w-20 h-20 bg-red-50 border border-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={36} className="text-red-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black text-slate-900 italic tracking-tight">RIDE CANCELLED</h3>
                  <p className="text-slate-500 text-sm mt-1">Passenger has been notified</p>
                </div>

                <motion.button
                  id="after-cancel-btn"
                  whileTap={{ scale: 0.97 }}
                  onClick={reset}
                  className="w-full py-5 rounded-2xl bg-gray-50 border border-gray-100 text-slate-600 font-black text-sm uppercase tracking-widest mt-4"
                >
                  Back to Hub
                </motion.button>
              </div>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
