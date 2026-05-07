"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocationStore, PaymentMethod } from '@/store/location.store';
import { useAuthStore } from '@/store/auth.store';
import { X, User, Phone, Mail, CreditCard, Banknote, ChevronRight, Edit2, Check, LogOut, Loader2 } from 'lucide-react';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const selectedPaymentMethod = useLocationStore((s) => s.selectedPaymentMethod);
  const setSelectedPaymentMethod = useLocationStore((s) => s.setSelectedPaymentMethod);
  const updateProfile = useLocationStore((s) => s.updateProfile);
  const cardNumber = useLocationStore((s) => s.cardNumber);
  const setCardNumber = useLocationStore((s) => s.setCardNumber);

  const userProfile = useLocationStore((s) => s.userProfile);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [draft, setDraft] = useState({ name: userProfile.name || user?.name || '', phone: userProfile.phone || '' });
  const [draftCard, setDraftCard] = useState(cardNumber || '');

  // Sync draft when user or userProfile changes (e.g. after login or fetchProfile)
  useEffect(() => {
    setDraft({ 
      name: userProfile.name || user?.name || '', 
      phone: userProfile.phone || '' 
    });
    setDraftCard(cardNumber || '');
  }, [user, userProfile, cardNumber]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ name: draft.name, phone: draft.phone });
      if (draftCard !== cardNumber) setCardNumber(draftCard);
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); setIsEditing(false); }, 1200);
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft({ name: userProfile.name || user?.name || '', phone: userProfile.phone || '' });
    setDraftCard(cardNumber);
    setIsEditing(false);
  };
  
  const handleLogout = () => {
    logout();
    onClose();
  };

  const formatCardDisplay = (num: string) => {
    if (!num) return 'Chưa thêm thẻ';
    const clean = num.replace(/\D/g, '').slice(-4);
    return `**** **** **** ${clean}`;
  };

  const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; icon: any; desc: string }[] = [
    { id: 'cash', label: 'Tiền mặt', icon: Banknote, desc: 'Thanh toán trực tiếp cho tài xế' },
    { id: 'card', label: 'Thẻ tín dụng', icon: CreditCard, desc: cardNumber ? formatCardDisplay(cardNumber) : 'Chưa thêm thẻ' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 z-[1200] pointer-events-auto"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 250 }}
            className="absolute left-0 top-0 h-full w-[85%] max-w-[340px] bg-white z-[1200] flex flex-col shadow-2xl pointer-events-auto"
          >
            {/* Header */}
            <div className="bg-[var(--color-primary)] pt-12 pb-6 px-5 relative">
              <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white">
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3 border-2 border-white/40">
                <User className="w-8 h-8 text-white" />
              </div>
              <p className="text-white font-bold text-lg leading-tight">{isEditing ? draft.name || userProfile.name || user?.name : (userProfile.name || user?.name || 'User')}</p>
              <p className="text-white/70 text-sm">{user?.email}</p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">

              {/* Personal Info */}
              <div className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-800">Thông tin cá nhân</h3>
                  {!isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium">
                      <Edit2 className="w-4 h-4" /> Sửa
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={handleCancel} className="text-sm text-gray-500">Hủy</button>
                      <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-semibold">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4 text-green-500" /> : <Check className="w-4 h-4" />}
                        {isSaving ? 'Đang lưu...' : 'Lưu'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {/* Name - Editable */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <User className="w-5 h-5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">Họ và tên</p>
                      {isEditing ? (
                        <input
                          className="w-full text-sm font-medium text-gray-900 bg-transparent border-b border-[var(--color-primary)] outline-none pb-0.5"
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          placeholder="Nhập họ và tên"
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">{userProfile.name || user?.name || 'Chưa cập nhật'}</p>
                      )}
                    </div>
                  </div>

                  {/* Phone - Editable */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">Số điện thoại</p>
                      {isEditing ? (
                        <input
                          type="tel"
                          className="w-full text-sm font-medium text-gray-900 bg-transparent border-b border-[var(--color-primary)] outline-none pb-0.5"
                          value={draft.phone}
                          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                          placeholder="Nhập số điện thoại"
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">{draft.phone || 'Chưa cập nhật'}</p>
                      )}
                    </div>
                  </div>

                  {/* Email - Readonly */}
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

              {/* Payment Methods */}
              <div className="p-5">
                <h3 className="font-bold text-gray-800 mb-4">Phương thức thanh toán</h3>
                <div className="flex flex-col gap-2">
                  {PAYMENT_OPTIONS.map((method) => {
                    const Icon = method.icon;
                    const isSelected = selectedPaymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                          isSelected ? 'border-[var(--color-primary)] bg-green-50' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`}>
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${isSelected ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                            {method.label}
                          </p>
                          <p className="text-xs text-gray-400">{method.desc}</p>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-[var(--color-primary)]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Card number input */}
                {selectedPaymentMethod === 'card' && (
                  <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <CreditCard className="w-5 h-5 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-0.5">Số thẻ tín dụng</p>
                      <input
                        type="text"
                        maxLength={19}
                        className="w-full text-sm font-medium text-gray-900 bg-transparent outline-none border-b border-[var(--color-primary)] pb-0.5"
                        value={isEditing ? draftCard : (cardNumber || '')}
                        readOnly={!isEditing}
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
        </>
      )}
    </AnimatePresence>
  );
}
