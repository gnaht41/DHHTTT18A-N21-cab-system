import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Rider App",
  description: "Book your ride in seconds",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="bg-gray-900 min-h-screen flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden">
          <main className="relative w-full h-[100dvh] sm:h-[min(850px,94vh)] sm:max-w-[400px] sm:rounded-[40px] shadow-2xl overflow-hidden bg-white mx-auto border-0 sm:border-[8px] border-gray-900 sm:border-gray-800 transition-all">
            <AuthGuard>
              {children}
            </AuthGuard>
          </main>
        </div>
      </body>
    </html>
  );
}
