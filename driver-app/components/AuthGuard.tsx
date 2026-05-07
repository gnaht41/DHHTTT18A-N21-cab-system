"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useDriverStore } from '@/store/driver.store';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkAuth, isCheckingAuth } = useAuthStore();
  const fetchDriverProfile = useDriverStore((s) => s.fetchDriverProfile);
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) fetchDriverProfile();
  }, [isAuthenticated, fetchDriverProfile]);

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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
