import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // All pages require auth + Supabase — disable static prerendering
  experimental: {},

  /**
   * Rewrite ZKTeco K50 iClock device paths to Next.js API routes.
   *
   * The K50 is configured with your server's domain (e.g. https://yourapp.com)
   * and automatically appends /iclock/cdata and /iclock/getrequest.
   * These rewrites transparently proxy those to the actual API handlers.
   *
   * Device cloud server setting: https://yourapp.com  (no path suffix needed)
   */
  async rewrites() {
    return [
      {
        source: '/iclock/:path*',
        destination: '/api/iclock/:path*',
      },
    ];
  },
};

// Force all pages to be dynamic at the framework level
export default nextConfig;

