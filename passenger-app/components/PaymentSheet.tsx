"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocationStore, PaymentMethod } from '@/store/location.store';
import { CreditCard, Banknote, CheckCircle, Loader2 } from 'lucide-react';

const PAYMENT_ICONS: Record<PaymentMethod, any> = {
  cash: Banknote,
  card: CreditCard,
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  card: 'Thẻ tín dụng',
};

export function PaymentSheet() {
  const fare = useLocationStore((s) => s.fare);
  const selectedPaymentMethod = useLocationStore((s) => s.selectedPaymentMethod);
  const setSelectedPaymentMethod = useLocationStore((s) => s.setSelectedPaymentMethod);
  const setUiState = useLocationStore((s) => s.setUiState);
  const driverDetails = useLocationStore((s) => s.driverDetails);

  const [isPaying, setIsPaying] = useState(false);

  const displayFare = fare > 0 ? fare : 45000; // mock fare in VND
  const baseFare = Math.round(displayFare * 0.6);
  const distanceFare = Math.round(displayFare * 0.4);

  const handlePay = async () => {
    setIsPaying(true);
    // Simulate payment processing (backend: POST /api/payments)
    await new Promise(r => setTimeout(r, 1800));
    setIsPaying(false);
    setUiState('payment_done');
  };

  const formatVND = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  const PaymentIcon = PAYMENT_ICONS[selectedPaymentMethod];

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute bottom-0 w-full z-[1050] pointer-events-none"
    >
      <div className="bg-white rounded-t-3xl shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.2)] p-5 pb-8 pointer-events-auto">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        <h2 className="text-xl font-bold text-gray-900 mb-1">Thanh toán chuyến đi</h2>
        {driverDetails && (
          <p className="text-sm text-gray-500 mb-5">Tài xế: {driverDetails.name} · {driverDetails.plate}</p>
        )}

        {/* Fare Breakdown */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Giá cước cơ bản</span>
            <span className="font-medium text-gray-800">{formatVND(baseFare)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Phí quãng đường</span>
            <span className="font-medium text-gray-800">{formatVND(distanceFare)}</span>
          </div>
          <div className="h-px bg-gray-200 my-1" />
          <div className="flex justify-between">
            <span className="font-bold text-gray-900">Tổng cộng</span>
            <span className="font-bold text-lg text-[var(--color-primary)]">{formatVND(displayFare)}</span>
          </div>
        </div>

        {/* Payment Method Select */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Thanh toán bằng</p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {(['cash', 'card'] as PaymentMethod[]).map((method) => {
            const Icon = PAYMENT_ICONS[method];
            const isSelected = selectedPaymentMethod === method;
            return (
              <button
                key={method}
                onClick={() => setSelectedPaymentMethod(method)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-[var(--color-primary)] bg-green-50'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? 'text-[var(--color-primary)]' : 'text-gray-500'}`} />
                <span className={`text-xs font-medium ${isSelected ? 'text-[var(--color-primary)]' : 'text-gray-600'}`}>
                  {PAYMENT_LABELS[method]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pay Button */}
        <button
          onClick={handlePay}
          disabled={isPaying}
          className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-70 active:scale-[0.98] transition-all text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
        >
          {isPaying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Đang thanh toán...
            </>
          ) : (
            <>
              <PaymentIcon className="w-5 h-5" />
              Thanh toán {formatVND(displayFare)}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

export function PaymentDoneSheet() {
  const setUiState = useLocationStore((s) => s.setUiState);

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute bottom-0 w-full z-[1050] pointer-events-none"
    >
      <div className="bg-white rounded-t-3xl p-6 pb-8 text-center pointer-events-auto shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.2)]">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-9 h-9 text-[var(--color-primary)]" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Thanh toán thành công!</h2>
        <p className="text-sm text-gray-500 mb-6">Chuyến đi của bạn đã được thanh toán. Bạn thấy hành trình này thế nào?</p>
        <button
          onClick={() => setUiState('reviewed')}
          className="w-full bg-[var(--color-primary)] text-white font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all"
        >
          Đánh giá tài xế
        </button>
        <button
          onClick={() => {
            const store = useLocationStore.getState();
            store.setUiState('map');
            store.setDestination(null as any);
            store.setRouteCoordinates(null);
            store.setDriverLocation(null);
            store.setDriverDetails(null);
          }}
          className="w-full mt-3 text-sm text-gray-400 py-2"
        >
          Để sau
        </button>
      </div>
    </motion.div>
  );
}
