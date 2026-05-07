"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Mail, Lock, AlertCircle, ArrowRight, Code, Globe } from 'lucide-react';
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
      // Error is handled by store
    }
  };

  return (
    <div className="h-full bg-white text-gray-900 font-sans selection:bg-green-100 flex flex-col max-w-md mx-auto relative overflow-hidden ring-1 ring-gray-100">
      
      {/* ── Background Decoration ── */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-br from-green-50 to-white -z-10" />
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-green-400/5 rounded-full blur-3xl" />

      {/* ── Top Bar ── */}
      <div className="px-6 py-4 flex justify-between items-center">
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
        >
            <div className="w-10 h-10 bg-[var(--color-primary)] rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-200">
                <LogIn size={20} />
            </div>
            <span className="font-black text-xl tracking-tight text-gray-900">Rider<span className="text-[var(--color-primary)]">App</span></span>
        </motion.div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 px-8 pb-6 flex flex-col">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.1 }}
        >
          <h1 className="text-4xl font-black leading-tight mb-2 tracking-tight">Let&apos;s get <br/>you <span className="text-[var(--color-primary)]">moving</span></h1>
          <p className="text-gray-500 font-medium mb-6">Sign in to book your next ride</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="p-4 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-3 text-red-600"
              >
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-sm font-bold">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            <div className="group">
              <div className="relative">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-4 py-4 bg-transparent border-b-2 border-gray-100 focus:border-[var(--color-primary)] outline-none transition-all text-lg font-semibold placeholder:text-gray-300 placeholder:font-normal"
                  placeholder="name@email.com"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8 pr-4 py-4 bg-transparent border-b-2 border-gray-100 focus:border-[var(--color-primary)] outline-none transition-all text-lg font-semibold placeholder:text-gray-300 placeholder:font-normal"
                  placeholder="••••••••"
                />
                <label className="absolute -top-2 left-8 text-[10px] font-black uppercase tracking-widest text-gray-400 opacity-0 group-focus-within:opacity-100 transition-opacity">Password</label>
              </div>
            </div>
            
            <div className="text-right">
                <button type="button" className="text-sm font-bold text-gray-400 hover:text-[var(--color-primary)] transition-colors">Forgot Password?</button>
            </div>
          </div>
        </form>

        {/* ── Social Login Section ── */}
        <div className="mt-6">
            <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Or continue with</span>
                <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-gray-100 font-bold text-sm hover:bg-gray-50 transition-colors active:scale-95">
                    <Globe size={18} className="text-red-500" />
                    Google
                </button>
                <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-gray-100 font-bold text-sm hover:bg-gray-50 transition-colors active:scale-95">
                    <Code size={18} />
                    GitHub
                </button>
            </div>
        </div>
      </div>

      {/* ── Bottom Section (Thumb Zone) ── */}
      <div className="px-8 pb-6 pt-2 bg-white/80 backdrop-blur-sm sticky bottom-0">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full h-16 bg-[var(--color-primary)] text-white rounded-[24px] font-black text-xl shadow-xl shadow-green-200 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-3 group"
        >
          {isLoading ? (
            <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight size={24} className="group-hover:translate-x-1.5 transition-transform" />
            </>
          )}
        </button>
        <p className="text-center mt-6 text-gray-500 font-medium tracking-tight">
          New here?{' '}
          <Link href="/register" className="text-[var(--color-primary)] font-black border-b-2 border-green-500/20 pb-0.5 ml-1">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
