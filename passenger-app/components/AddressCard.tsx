"use client";

import { MapPin } from "lucide-react";

interface AddressCardProps {
  label: string;
  address: string;
  isLoading: boolean;
  onClick?: () => void;
  type: 'pickup' | 'destination';
}

export function AddressCard({ label, address, isLoading, onClick, type }: AddressCardProps) {
  const iconColor = type === 'pickup' ? 'text-primary' : 'text-blue-500';

  return (
    <div 
      className={`flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white/80 transition-colors ${onClick ? 'cursor-pointer active:bg-gray-50' : ''}`}
      onClick={onClick}
    >
      <div className="flex-shrink-0">
        <div className={`p-2 rounded-full bg-opacity-10 ${type === 'pickup' ? 'bg-primary text-[var(--color-primary)]' : 'bg-blue-500 text-blue-500'}`}>
          <MapPin size={20} className={iconColor} />
        </div>
      </div>
      
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        {isLoading ? (
          <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
        ) : (
          <p className="text-sm font-medium text-gray-900 truncate">
            {address || "Searching address..."}
          </p>
        )}
      </div>
    </div>
  );
}
