"use client";

import dynamic from 'next/dynamic';

const DriverHome = dynamic(
  () => import('@/features/driver/DriverHome').then((m) => ({ default: m.DriverHome })),
  { ssr: false }
);

export default function DriverPage() {
  return (
    <>
        <DriverHome />
    </>
  );
}
