"use client";

import { motion } from 'framer-motion';
import { useLocationStore, VehicleType } from '@/store/location.store';

// ─── Fare Configuration ───────────────────────────────────────────────────────
const VEHICLE_CONFIG: Record<VehicleType, {
  emoji: string;
  label: string;
  seats: string;
  baseFare: number;
  perKm: number;
  desc: string;
}> = {
  bike: {
    emoji: '🛵',
    label: 'Xe máy',
    seats: '1 chỗ',
    baseFare: 10000,
    perKm: 4000,
    desc: 'Nhanh, tiết kiệm',
  },
  economy: {
    emoji: '🚗',
    label: 'Economy',
    seats: '4 chỗ',
    baseFare: 15000,
    perKm: 8500,
    desc: 'Tiêu chuẩn, thoải mái',
  },
  premium: {
    emoji: '🚙',
    label: 'Premium',
    seats: '7 chỗ',
    baseFare: 20000,
    perKm: 12000,
    desc: 'Rộng rãi, cao cấp',
  },
};

export function calculateFare(type: VehicleType, distanceKm: number): number {
  const cfg = VEHICLE_CONFIG[type];
  const raw = cfg.baseFare + cfg.perKm * distanceKm;
  return Math.round(raw / 1000) * 1000; // round to nearest 1000₫
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface VehicleSelectorProps {
  distanceKm: number;
}

export function VehicleSelector({ distanceKm }: VehicleSelectorProps) {
  const vehicleType = useLocationStore((s) => s.vehicleType);
  const setVehicleType = useLocationStore((s) => s.setVehicleType);
  const setFare = useLocationStore((s) => s.setFare);

  const handleSelect = (type: VehicleType) => {
    setVehicleType(type);
    setFare(calculateFare(type, distanceKm));
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">Chọn loại xe</p>
      {(Object.keys(VEHICLE_CONFIG) as VehicleType[]).map((type) => {
        const cfg = VEHICLE_CONFIG[type];
        const fare = calculateFare(type, distanceKm);
        const isSelected = vehicleType === type;

        return (
          <motion.button
            key={type}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect(type)}
            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left w-full ${
              isSelected
                ? 'border-[var(--color-primary)] bg-green-50 shadow-md shadow-green-100'
                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
            }`}
          >
            {/* Icon */}
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
              isSelected ? 'bg-[var(--color-primary)]/10' : 'bg-white border border-gray-100'
            }`}>
              {cfg.emoji}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={`font-bold text-sm ${isSelected ? 'text-[var(--color-primary)]' : 'text-gray-800'}`}>
                  {cfg.label}
                </p>
                <span className="text-xs text-gray-400 font-medium">· {cfg.seats}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{cfg.desc}</p>
            </div>

            {/* Price */}
            <div className="text-right shrink-0">
              <p className={`font-black text-sm ${isSelected ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                {distanceKm > 0 ? formatVND(fare) : '–'}
              </p>
              {distanceKm > 0 && (
                <p className="text-xs text-gray-400">{distanceKm} km</p>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
