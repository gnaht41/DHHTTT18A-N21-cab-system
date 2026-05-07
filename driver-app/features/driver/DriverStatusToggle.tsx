"use client";

import { useDriverStore } from '@/store/driver.store';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Wifi, WifiOff } from 'lucide-react';

export function DriverStatusToggle() {
  const isOnline = useDriverStore((s) => s.isOnline);
  const setIsOnline = useDriverStore((s) => s.setIsOnline);
  const rideStatus = useDriverStore((s) => s.rideStatus);

  const toggle = () => {
    setIsOnline(!isOnline);
  };

  // Hide toggle when in a ride
  if (['ACCEPTED', 'ARRIVED_PICKUP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(rideStatus)) return null;

  return (
    <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
      {/* Status badge */}
      <AnimatePresence mode="wait">
        <motion.div
          key={isOnline ? 'online' : 'offline'}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase flex items-center gap-2 shadow-xl border ${
            isOnline
              ? 'bg-[var(--color-primary)] border-green-400 text-white'
              : 'bg-white border-gray-100 text-slate-400'
          }`}
        >
          {isOnline ? (
            <><Wifi size={12} strokeWidth={3} /><span>Online</span></>
          ) : (
            <><WifiOff size={12} /><span>Offline</span></>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Big toggle button */}
      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.92 }}
        className={`w-24 h-24 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.1)] flex items-center justify-center transition-all duration-500 border-4 ${
          isOnline
            ? 'bg-[var(--color-primary)] border-green-500/20 shadow-green-500/20'
            : 'bg-white border-gray-50 shadow-slate-200'
        }`}
        aria-label={isOnline ? 'Go Offline' : 'Go Online'}
        id="driver-status-toggle"
      >
        <div className={`absolute inset-0 rounded-full ${isOnline ? 'animate-ping bg-green-500/20' : ''}`} />
        <Power
          size={36}
          className={`relative z-10 transition-colors duration-300 ${isOnline ? 'text-white' : 'text-slate-300'}`}
          strokeWidth={3}
        />
      </motion.button>
    </div>
  );
}
