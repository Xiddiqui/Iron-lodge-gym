import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // All pages require auth + Supabase — disable static prerendering
  experimental: {},
};

// Force all pages to be dynamic at the framework level
export default nextConfig;

