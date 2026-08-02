import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Iron Lodge Gym',
  description: 'Iron Lodge Gym – Digital gym register: members, monthly fees, expenses, and profit at a glance.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  other: {
    'theme-color': '#a3e635',
    'apple-mobile-web-app-capable': 'yes',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Iron Lodge Gym',
  },
  openGraph: {
    title: 'Iron Lodge Gym',
    description: 'Iron Lodge Gym – Digital gym register: members, fees, expenses and profit dashboard.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <QueryProvider>
          {children}
          <Toaster theme="dark" position="top-right" richColors closeButton />
        </QueryProvider>
      </body>
    </html>
  );
}
