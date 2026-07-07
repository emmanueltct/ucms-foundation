import type { Metadata } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'UCMS',
  description: 'Unified Church Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', GeistSans.variable)}>
      <body>{children}</body>
    </html>
  );
}
