"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useLocationStore } from '@/store/location.store';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkAuth, isCheckingAuth } = useAuthStore();
  const fetchUserProfile = useLocationStore((s) => s.fetchUserProfile);
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    checkAuth();
  }, [checkAuth]);

  // Fetch profile when authenticated to load phone number etc.
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserProfile();
    }
  }, [isAuthenticated, fetchUserProfile]);

  useEffect(() => {
    if (!isMounted || isCheckingAuth) return;

    const publicPaths = ['/login', '/register'];
    const isPublicPath = publicPaths.includes(pathname);

    if (!isAuthenticated && !isPublicPath) {
      router.push('/login');
    } else if (isAuthenticated && isPublicPath) {
      router.push('/');
    }
  }, [isAuthenticated, pathname, router, isMounted, isCheckingAuth]);

  if (!isMounted || isCheckingAuth) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
