"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Mail, Lock, User, AlertCircle, ArrowLeft, CheckCircle2, ShieldCheck, Car } from 'lucide-react';
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
      await register(name, email, password, 'driver');
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-12 text-center max-w-md mx-auto shadow-2xl">
        <motion.div 
          initial={{ rotate: -15, scale: 0.5, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-[var(--color-primary)] rounded-[32px] flex items-center justify-center mb-10 shadow-3xl shadow-green-500/20"
        >
          <CheckCircle2 size={48} className="text-white" />
        </motion.div>
        <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Access Granted!</h1>
        <p className="text-slate-400 font-bold leading-relaxed uppercase tracking-widest text-xs">Initialization in progress... Redirecting to Dashboard.</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-white text-slate-900 font-sans flex flex-col max-w-md mx-auto relative overflow-hidden">
      
      {/* ── Background Elements ── */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-green-500/5 to-transparent -z-10" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-green-500/5 rounded-full blur-[100px]" />

      <div className="px-6 pt-6 pb-2 flex items-center justify-between relative z-10">
        <Link href="/login" className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center active:scale-90 transition-all">
            <ArrowLeft size={24} className="text-[var(--color-primary)]" />
        </Link>
        <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 transition-colors">Contractor App</p>
            <p className="text-xs font-black text-slate-900 italic">v2.4.0-Stable</p>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 px-8 pt-4 pb-6 flex flex-col">
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           className="mb-6"
        >
          <h1 className="text-4xl font-black italic tracking-tighter leading-tight mb-2 text-slate-900">JOIN THE <br/><span className="text-[var(--color-primary)]">FLEET</span></h1>
          <div className="h-1.5 w-16 bg-[var(--color-primary)] rounded-full" />
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6 flex-1">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-5 bg-red-50 border border-red-100 rounded-[28px] flex items-start gap-4 text-red-500"
              >
                <AlertCircle size={22} className="shrink-0 mt-0.5" />
                <p className="text-sm font-black uppercase italic tracking-tight leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            <div className="group">
              <div className="relative border-b-2 border-gray-100 focus-within:border-[var(--color-primary)] transition-colors py-1">
                <User className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 bg-transparent outline-none text-xl font-black text-slate-900 placeholder:text-gray-200 transition-all py-2"
                  placeholder="Legal Name"
                />
                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-[var(--color-primary)] transition-all opacity-0 group-focus-within:opacity-100">Full Name</label>
              </div>
            </div>

            <div className="group">
              <div className="relative border-b-2 border-gray-100 focus-within:border-[var(--color-primary)] transition-colors py-1">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 bg-transparent outline-none text-xl font-black text-slate-900 placeholder:text-gray-200 transition-all py-2"
                  placeholder="Primary Email"
                />
                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-[var(--color-primary)] transition-all opacity-0 group-focus-within:opacity-100">Digital Identity</label>
              </div>
            </div>

            <div className="group">
              <div className="relative border-b-2 border-gray-100 focus-within:border-[var(--color-primary)] transition-colors py-1">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 bg-transparent outline-none text-xl font-black text-slate-900 placeholder:text-gray-200 transition-all py-2"
                  placeholder="••••••••"
                />
                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-[var(--color-primary)] transition-all opacity-0 group-focus-within:opacity-100">Access Pin</label>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ── Bottom Section ── */}
      <div className="px-8 pb-6 pt-4 bg-white/80 backdrop-blur-xl sticky bottom-0">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full h-18 bg-[var(--color-primary)] text-white rounded-[32px] font-black text-xl shadow-2xl active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-4"
        >
          {isLoading ? (
            <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Confirm & Apply
              <ShieldCheck size={24} className="text-white" />
            </>
          )}
        </button>
        <p className="text-center mt-6 text-[8px] text-slate-200 font-black uppercase tracking-[0.4em]">
            Enterprise Platform Protocol Enabled
        </p>
      </div>
    </div>
  );
}
