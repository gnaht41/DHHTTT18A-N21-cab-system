"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useDriverStore } from '@/store/driver.store';
import { useAuthStore } from '@/store/auth.store';
import { connectSocket } from '@/services/socket';
import { DriverStatusToggle } from './DriverStatusToggle';
import { RideRequestCard } from './RideRequestCard';
import { TripPanel } from './TripPanel';
import { Earnings } from './Earnings';
import { TrendingUp, User, Star, Car, LogOut, X, ChevronRight, Mail, Phone, ShieldCheck, Edit2, Check, Loader2, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

const DriverMap = dynamic(() => import('./DriverMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm font-semibold">Loading Map...</p>
      </div>
    </div>
  ),
});

export function DriverHome() {
  const [isEarningsOpen, setIsEarningsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const rideStatus = useDriverStore((s) => s.rideStatus);
  const isOnline = useDriverStore((s) => s.isOnline);
  const driverProfile = useDriverStore((s) => s.driverProfile);
  const setDriverProfile = useDriverStore((s) => s.setDriverProfile);
  const updateDriverProfile = useDriverStore((s) => s.updateDriverProfile);
  const fetchDriverProfile = useDriverStore((s) => s.fetchDriverProfile);
  const fetchRideHistory = useDriverStore((s) => s.fetchRideHistory);
  const initializeSocketListeners = useDriverStore((s) => s.initializeSocketListeners);
  const todayEarnings = useDriverStore((s) => s.todayEarnings);
  const cardNumber = useDriverStore((s) => s.cardNumber);
  const setCardNumber = useDriverStore((s) => s.setCardNumber);

  const [draft, setDraft] = useState({ name: '', phone: '', vehicle: '', plate: '' });
  const [draftCard, setDraftCard] = useState('');

  useEffect(() => {
    if (user?.id) {
      setDriverProfile({
        id: user.id,
        email: user.email,
        ...(user.name ? { name: user.name } : {})
      });
      setDraft({
        name: user.name || '',
        phone: driverProfile.phone || '',
        vehicle: driverProfile.vehicle || '',
        plate: driverProfile.plate || ''
      });
      const socket = connectSocket(user.id, 'driver');
      initializeSocketListeners(String(user.id));

      // Fetch real driver data from backend
      fetchDriverProfile();
      fetchRideHistory();


      return () => {
        socket.disconnect();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Sync draft when profile panel opens
  useEffect(() => {
    if (isProfileOpen) {
      setDraft({
        name: driverProfile.name || user?.name || '',
        phone: driverProfile.phone || '',
        vehicle: driverProfile.vehicle || '',
        plate: driverProfile.plate || ''
      });
      setDraftCard(cardNumber || '');
      setIsEditing(false);
    }
  }, [isProfileOpen, driverProfile.name, driverProfile.phone, driverProfile.vehicle, driverProfile.plate, user?.name, cardNumber]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDriverProfile({
        name: draft.name,
        phone: draft.phone,
        vehicle: draft.vehicle,
        plate: draft.plate
      });
      if (draftCard !== cardNumber) setCardNumber(draftCard);
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Show name same as passenger header: e.g. "văn lộc"
  const displayName = driverProfile.name || user?.name || 'Tài xế';

  const formatEarnings = (e: number) => {
    const val = Math.round(e);
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M₫`;
    if (val >= 1000) return `${Math.floor(val / 1000)}k₫`;
    return `${val}₫`;
  };

  const showHeader = !['ACCEPTED', 'ARRIVED_PICKUP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(rideStatus);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-50">

      {/* ── Full-screen Map ── */}
      <DriverMap />

      {/* ── Top Header ── */}
      {showHeader && (
        <div className="absolute top-0 w-full z-40 p-4 pt-12 flex justify-between items-start pointer-events-none">
          {/* Left: driver info */}
          <div className="pointer-events-auto">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="bg-white/95 backdrop-blur-xl border border-gray-100 shadow-2xl rounded-2xl px-3 py-2.5 flex items-center gap-2.5 transition-all active:scale-95 hover:bg-gray-50"
            >
              <div className="w-9 h-9 bg-[var(--color-primary)] rounded-xl flex items-center justify-center shrink-0 border border-green-500/20 shadow-lg shadow-green-500/20">
                <User size={18} className="text-white" strokeWidth={3} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900 leading-none">
                  {displayName}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Star size={10} className="text-amber-500 fill-amber-500" />
                  <span className="text-[10px] text-slate-500 font-bold">{driverProfile.rating}</span>
                  <span className="text-[10px] text-slate-300 mx-0.5">·</span>
                  <Car size={10} className="text-slate-400" />
                  <span className="text-[10px] text-slate-400 font-bold">{driverProfile.plate}</span>
                </div>
              </div>
              {/* Online dot */}
              <div className={`w-2.5 h-2.5 rounded-full ml-1 ${isOnline ? 'bg-[var(--color-primary)] shadow-[0_0_8px_rgba(0,177,79,0.8)]' : 'bg-slate-200'}`} />
            </button>
          </div>

          {/* Right: app badge + earnings button */}
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="bg-white/95 backdrop-blur-md border border-gray-100 px-4 py-2 rounded-full shadow-2xl">
              <h1 className="text-slate-900 font-black text-xs tracking-widest flex items-center gap-2 italic">
                <div className="w-4 h-4 rounded-sm bg-[var(--color-primary)] flex items-center justify-center text-[10px] text-white italic font-black">G</div>
                <span>DRIVER</span>
              </h1>
            </div>

            <button
              id="open-earnings-btn"
              onClick={() => setIsEarningsOpen(true)}
              className="bg-[var(--color-primary)] shadow-[0_8px_25px_rgba(0,177,79,0.3)] px-4 py-2 rounded-2xl flex items-center gap-2 transition-all active:scale-95 hover:bg-green-500"
            >
              <TrendingUp size={14} className="text-white" strokeWidth={3} />
              <span className="text-white text-sm font-black">{formatEarnings(todayEarnings)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Profile Menu Overlay ── */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="absolute inset-0 z-[100] flex flex-col">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-[85%] max-w-[340px] h-full bg-white flex flex-col shadow-2xl"
            >
              {/* Green header — mirrors Passenger ProfilePanel */}
              <div className="bg-[var(--color-primary)] pt-12 pb-6 px-5 relative shrink-0">
                <button onClick={() => setIsProfileOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white">
                  <X className="w-5 h-5" />
                </button>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3 border-2 border-white/40">
                  <User className="w-8 h-8 text-white" />
                </div>
                <p className="text-white font-bold text-lg leading-tight">{driverProfile.name || user?.name || 'Tài xế'}</p>
                <p className="text-white/70 text-sm">{user?.email}</p>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">

                {/* Personal info section */}
                <div className="p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800">Thông tin cá nhân</h3>
                    {!isEditing ? (
                      <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium">
                        <Edit2 className="w-4 h-4" /> Sửa
                      </button>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={() => setIsEditing(false)} className="text-sm text-gray-500">Hủy</button>
                        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-semibold">
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          {isSaving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Name */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <User className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">Họ và tên</p>
                        {isEditing ? (
                          <input className="w-full text-sm font-medium text-gray-900 bg-transparent border-b border-[var(--color-primary)] outline-none pb-0.5" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nhập họ và tên" />
                        ) : (
                          <p className="text-sm font-medium text-gray-900 truncate">{driverProfile.name || user?.name || 'Chưa cập nhật'}</p>
                        )}
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">Số điện thoại</p>
                        {isEditing ? (
                          <input type="tel" className="w-full text-sm font-medium text-gray-900 bg-transparent border-b border-[var(--color-primary)] outline-none pb-0.5" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Nhập số điện thoại" />
                        ) : (
                          <p className="text-sm font-medium text-gray-900 truncate">{driverProfile.phone || 'Chưa cập nhật'}</p>
                        )}
                      </div>
                    </div>

                    {/* Email readonly */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl opacity-70">
                      <Mail className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">Email (không thể đổi)</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-100 mx-5" />

                {/* Vehicle section */}
                <div className="p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Thông tin xe</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Car className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">Loại xe</p>
                        {isEditing ? (
                          <input className="w-full text-sm font-medium text-gray-900 bg-transparent border-b border-[var(--color-primary)] outline-none pb-0.5" value={draft.vehicle} onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })} placeholder="VD: Toyota Vios" />
                        ) : (
                          <p className="text-sm font-medium text-gray-900 truncate">{driverProfile.vehicle || 'Chưa cập nhật'}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <ShieldCheck className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">Biển số xe</p>
                        {isEditing ? (
                          <input className="w-full text-sm font-medium text-gray-900 bg-transparent border-b border-[var(--color-primary)] outline-none pb-0.5" value={draft.plate} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} placeholder="VD: 29A-888.88" />
                        ) : (
                          <p className="text-sm font-medium text-gray-900 truncate">{driverProfile.plate || 'Chưa cập nhật'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-100 mx-5" />

                {/* Card section */}
                <div className="p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Tài khoản nhận tiền</h3>
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-gray-100 bg-gray-50">
                    <div className="p-2 rounded-lg bg-gray-200">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-700">Thẻ nhận doanh thu</p>
                      <p className="text-xs text-gray-400">
                        {cardNumber ? `**** **** **** ${cardNumber.replace(/\D/g, '').slice(-4)}` : 'Chưa thêm thẻ'}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <CreditCard className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-0.5">Số thẻ</p>
                        <input
                          type="text" maxLength={19}
                          className="w-full text-sm font-medium text-gray-900 bg-transparent outline-none border-b border-[var(--color-primary)] pb-0.5"
                          value={draftCard}
                          onChange={(e) => setDraftCard(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim())}
                          placeholder="0000 0000 0000 0000"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-100 mx-5" />

                {/* Logout */}
                <div className="p-5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between p-3.5 bg-red-50 hover:bg-red-100 transition-colors rounded-xl group"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-600">Đăng xuất</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-red-300 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Status bar shown during ride ── */}
      {!showHeader && (
        <div className="absolute top-0 w-full z-40 p-4 pt-12 pointer-events-none">
          <div className="pointer-events-auto mx-auto w-fit bg-white/95 backdrop-blur-xl border border-gray-100 px-5 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[var(--color-primary)] animate-pulse shadow-[0_0_10px_rgba(0,177,79,1)]" />
            <span className="text-slate-900 text-sm font-black italic tracking-tight">
              {rideStatus === 'ACCEPTED' && 'HEADING TO PICKUP'}
              {rideStatus === 'ARRIVED_PICKUP' && 'WAITING FOR PASSENGER'}
              {rideStatus === 'IN_PROGRESS' && 'DRIVING TO DESTINATION'}
              {rideStatus === 'COMPLETED' && 'TRIP COMPLETED'}
              {rideStatus === 'CANCELLED' && 'RIDE CANCELLED'}
            </span>
          </div>
        </div>
      )}

      {/* ── Status Toggle ── */}
      <DriverStatusToggle />

      {/* ── Ride Request Popup ── */}
      <RideRequestCard />

      {/* ── Trip Status Panel ── */}
      <TripPanel />

      {/* ── Earnings Panel ── */}
      <Earnings isOpen={isEarningsOpen} onClose={() => setIsEarningsOpen(false)} />
    </div>
  );
}
