"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useDriverStore } from '@/store/driver.store';
import { X, TrendingUp, Navigation, Star, Loader2, AlertCircle, User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EarningsProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M₫`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k₫`;
  return `${amount}₫`;
}

function formatDateTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function haversineKm(a: string, b: string): number {
  try {
    const [lat1, lng1] = a.split(',').map(Number);
    const [lat2, lng2] = b.split(',').map(Number);
    if ([lat1, lng1, lat2, lng2].some(isNaN)) return 0;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const hav =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav)) * 10) / 10;
  } catch {
    return 0;
  }
}

export function Earnings({ isOpen, onClose }: EarningsProps) {
  const tripHistory = useDriverStore((s) => s.tripHistory);
  const driverProfile = useDriverStore((s) => s.driverProfile);
  const todayEarnings = useDriverStore((s) => s.todayEarnings);
  const fetchRideHistory = useDriverStore((s) => s.fetchRideHistory);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchRideHistory().finally(() => setIsLoading(false));
    }
  }, [isOpen, fetchRideHistory]);

  const tripCount = tripHistory.length;
  const rating = driverProfile.rating || '5.0';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — above Leaflet controls (z ~1000) */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 z-[1100]"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 250 }}
            className="absolute bottom-0 left-0 right-0 z-[1101] bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--color-primary)] rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Tổng doanh thu</p>
                  <p className="text-2xl font-bold text-gray-900 leading-tight">{formatCurrency(todayEarnings)}</p>
                </div>
              </div>
              <button onClick={onClose} id="close-earnings-btn" className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 divide-x divide-gray-100 border-y border-gray-100 mx-4 mb-3 bg-gray-50 rounded-xl shrink-0">
              <div className="py-3 text-center">
                <p className="text-xs text-gray-400 mb-0.5">Chuyến đã đi</p>
                <p className="text-lg font-bold text-gray-900">{tripCount}</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-xs text-gray-400 mb-0.5">Đánh giá TB</p>
                <p className="text-lg font-bold text-[var(--color-primary)] flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {rating}
                </p>
              </div>
            </div>

            {/* Trip list */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 pb-2">
                <h3 className="font-bold text-gray-800 text-sm">Lịch sử chuyến đi</h3>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Loader2 className="w-7 h-7 animate-spin mb-2" />
                  <p className="text-sm">Đang tải lịch sử...</p>
                </div>
              ) : tripHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                  <AlertCircle className="w-9 h-9 mb-2 opacity-40" />
                  <p className="text-sm text-gray-400">Chưa có chuyến nào</p>
                </div>
              ) : (
                <div className="px-5 pb-8 flex flex-col">
                  {tripHistory.map((trip, i) => {
                    const km = trip.distanceKm > 0 ? trip.distanceKm : haversineKm(trip.pickup, trip.destination);
                    return (
                      <div key={`${trip.id}-${i}`} className="flex items-start gap-3 py-3.5 border-b border-gray-100 last:border-0">
                        <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Navigation className="w-4 h-4 text-[var(--color-primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Passenger name */}
                          <div className="flex items-center gap-1 mb-0.5">
                            <User className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="text-xs font-medium text-gray-500 truncate">{trip.passengerName}</span>
                          </div>
                          {/* Pickup */}
                          <p className="text-sm font-semibold text-gray-900 truncate">{trip.pickup}</p>
                          {/* Destination */}
                          <p className="text-xs text-gray-400 truncate mt-0.5">→ {trip.destination}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">{km} km</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-400">{formatDateTime(trip.completedAt)}</span>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-[var(--color-primary)] shrink-0 mt-0.5">
                          +{formatCurrency(trip.fare)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
