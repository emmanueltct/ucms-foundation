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
    <html lang="en" className={cn('font-sans', GeistSans.variable)} suppressHydrationWarning>
      <head>
        <script
          // Sets the .dark class before first paint so there's no light-mode
          // flash for users who previously chose (or whose OS prefers) dark mode.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(!s&&d)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
