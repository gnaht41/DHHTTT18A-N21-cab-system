"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Mail, Lock, User, AlertCircle, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const { register, isLoading, error } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(name, email, password, 'passenger');
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      // Error handled by store
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-10 text-center max-w-md mx-auto shadow-2xl">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          className="w-24 h-24 bg-green-50 rounded-[32px] flex items-center justify-center mb-8 shadow-xl shadow-green-100"
        >
          <CheckCircle2 className="w-12 h-12 text-[var(--color-primary)]" />
        </motion.div>
        <h1 className="text-3xl font-black text-gray-950 mb-3 tracking-tight">You&apos;re all set!</h1>
        <p className="text-gray-500 font-medium leading-relaxed">Account created successfully. Taking you to sign in...</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-white text-gray-900 font-sans selection:bg-green-100 flex flex-col max-w-md mx-auto relative overflow-hidden ring-1 ring-gray-100">
      
      {/* ── Background Decoration ── */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-br from-green-50 to-white -z-10" />
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-green-400/5 rounded-full blur-3xl" />

      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <Link href="/login" className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft size={24} className="text-gray-600" />
        </Link>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">New User</span>
          <span className="text-xs font-bold text-gray-900">Step 1 of 1</span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-8 pt-4 pb-10 flex flex-col">
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
        >
            <h1 className="text-4xl font-black leading-tight mb-3 tracking-tight">Create <br/><span className="text-[var(--color-primary)]">Account</span></h1>
            <p className="text-gray-500 font-medium mb-6">Start your journey with us today</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6 flex-1">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-3 text-red-600"
              >
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-sm font-bold">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            <div className="group">
              <div className="relative">
                <User className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-8 pr-4 py-4 bg-transparent border-b-2 border-gray-100 focus:border-[var(--color-primary)] outline-none transition-all text-lg font-semibold placeholder:text-gray-300 placeholder:font-normal"
                  placeholder="Full Name"
                />
                <label className="absolute -top-2 left-8 text-[10px] font-black uppercase tracking-widest text-gray-400 opacity-0 group-focus-within:opacity-100 transition-opacity">Full Name</label>
              </div>
            </div>

            <div className="group">
              <div className="relative">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-4 py-4 bg-transparent border-b-2 border-gray-100 focus:border-[var(--color-primary)] outline-none transition-all text-lg font-semibold placeholder:text-gray-300 placeholder:font-normal"
                  placeholder="Email Address"
                />
                <label className="absolute -top-2 left-8 text-[10px] font-black uppercase tracking-widest text-gray-400 opacity-0 group-focus-within:opacity-100 transition-opacity">Email Address</label>
              </div>
            </div>

            <div className="group">
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8 pr-4 py-4 bg-transparent border-b-2 border-gray-100 focus:border-[var(--color-primary)] outline-none transition-all text-lg font-semibold placeholder:text-gray-300 placeholder:font-normal"
                  placeholder="Password"
                />
                <label className="absolute -top-2 left-8 text-[10px] font-black uppercase tracking-widest text-gray-400 opacity-0 group-focus-within:opacity-100 transition-opacity">Password</label>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ── Sticky Bottom Section ── */}
      <div className="px-8 pb-6 pt-4 bg-white/80 backdrop-blur-sm sticky bottom-0">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full h-16 bg-gray-950 text-white rounded-[24px] font-black text-xl shadow-2xl active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Complete Registration
              <ShieldCheck size={22} className="text-[var(--color-primary)]" />
            </>
          )}
        </button>
        <p className="text-center mt-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            By signing up, you agree to our <span className="text-gray-900 border-b border-gray-200">Terms of Use</span>
        </p>
      </div>
    </div>
  );
}
