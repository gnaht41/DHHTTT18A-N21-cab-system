"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Mail, Lock, AlertCircle, ArrowRight, Car, Zap, Trophy } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div className="h-full bg-white text-slate-900 font-sans flex flex-col max-w-md mx-auto relative overflow-hidden">
      
      {/* ── Background Elements ── */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-green-500/5 to-transparent -z-10" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-green-500/5 rounded-full blur-[100px]" />

      {/* ── Driver Branding ── */}
      <div className="px-8 pt-4 pb-2">
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-12 h-12 bg-[var(--color-primary)] rounded-[16px] shadow-2xl shadow-green-500/20 flex items-center justify-center mb-4"
        >
            <Car size={24} className="text-white" />
        </motion.div>
        
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-black tracking-tight mb-1 leading-tight text-slate-900">Driver <br/><span className="text-[var(--color-primary)]">Workspace</span></h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Enterprise Secure Access</p>
        </motion.div>
      </div>

      {/* ── Form Section ── */}
      <div className="flex-1 px-8 pb-6 flex flex-col">
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="p-5 bg-red-50 border border-red-100 rounded-[24px] flex items-center gap-4 text-red-500"
              >
                <AlertCircle size={22} className="shrink-0" />
                <p className="text-sm font-black italic uppercase tracking-tight">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            <div className="group">
              <div className="relative border-b-2 border-gray-100 focus-within:border-[var(--color-primary)] transition-colors py-2">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 bg-transparent outline-none text-xl font-black text-slate-900 placeholder:text-gray-200 transition-all py-2"
                  placeholder="name@cabsystem.com"
                />
                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-[var(--color-primary)] transition-all opacity-0 group-focus-within:opacity-100">Fleet Identity</label>
              </div>
            </div>

            <div className="group">
              <div className="relative border-b-2 border-gray-100 focus-within:border-[var(--color-primary)] transition-colors py-2">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 bg-transparent outline-none text-xl font-black text-slate-900 placeholder:text-gray-200 transition-all py-2"
                  placeholder="••••••••"
                />
                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-[var(--color-primary)] transition-all opacity-0 group-focus-within:opacity-100">Secure Access Code</label>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                    <Zap size={14} className="text-[var(--color-primary)]" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">High Surge Local</span>
                </div>
                <button type="button" className="text-xs font-black text-slate-400 hover:text-[var(--color-primary)] transition-colors uppercase tracking-widest">Forgot Pin?</button>
            </div>
          </div>
        </form>

        {/* ── Stats Mock ── */}
        <div className="mt-4 bg-gray-50 rounded-[32px] p-4 border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center">
                    <Trophy size={20} className="text-[var(--color-primary)]" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Fleet Perks</p>
                    <p className="text-sm font-black text-slate-900">Platinum Driver Status</p>
                </div>
            </div>
            <ArrowRight size={16} className="text-gray-200" />
        </div>
      </div>

      {/* ── Fixed Bottom CTA ── */}
      <div className="px-8 pb-6 pt-4 bg-white/80 backdrop-blur-xl sticky bottom-0">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full h-18 bg-[var(--color-primary)] text-white rounded-[28px] font-black text-xl shadow-2xl shadow-green-500/10 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-3 group"
        >
          {isLoading ? (
            <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Go Online
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <ArrowRight size={24} />
              </motion.div>
            </>
          )}
        </button>
        <p className="text-center mt-8 text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">
          Need an account?{' '}
          <Link href="/register" className="text-[var(--color-primary)] ml-1 border-b border-green-500/20">
            Join Platform
          </Link>
        </p>
      </div>
    </div>
  );
}
