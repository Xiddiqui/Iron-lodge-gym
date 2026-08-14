'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Dumbbell, Loader2 } from 'lucide-react';

export default function Loading() {
  const [gymName, setGymName] = useState('Iron Lodge Gym');
  const [logoUrl, setLogoUrl] = useState<string | null>('/logo.png');
  const [primaryColor, setPrimaryColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gym_primary_color') || '#10b981';
    }
    return '#10b981';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gym_primary_color');
      if (stored) setPrimaryColor(stored);
    }

    supabase
      .from('gym_settings')
      .select('gym_name, logo_url, landing_page_data')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.gym_name) setGymName(data.gym_name);
          if (data.logo_url) setLogoUrl(data.logo_url);
          const color = data.landing_page_data?.theme?.primaryColor;
          if (color) {
            setPrimaryColor(color);
            try { localStorage.setItem('gym_primary_color', color); } catch {}
          }
        }
      });
  }, []);

  const displayLogo = logoUrl || '/logo.png';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient background glow in selected color shade */}
      <div
        className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl opacity-25 animate-pulse pointer-events-none"
        style={{ backgroundColor: primaryColor }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 p-4">
        {/* Animated Logo Container with glowing ring */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing outer aura ring in selected color shade */}
          <div
            className="absolute -inset-4 rounded-3xl opacity-50 blur-md animate-pulse"
            style={{ backgroundColor: primaryColor }}
          />

          {/* Rotating gradient ring border in selected color shade */}
          <div
            className="absolute -inset-2 rounded-2xl animate-spin border-2 border-transparent"
            style={{
              borderTopColor: primaryColor,
              borderRightColor: primaryColor,
              animationDuration: '3s',
            }}
          />

          {/* Logo Badge Container */}
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-white p-3.5 shadow-2xl backdrop-blur-xl flex items-center justify-center overflow-hidden">
            <img
              src={displayLogo}
              alt={gymName}
              className="h-full w-full object-contain filter drop-shadow-lg animate-pulse"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.root-logo-fallback');
                if (fallback) (fallback as HTMLElement).style.display = 'flex';
              }}
            />
            <div className="root-logo-fallback hidden h-full w-full items-center justify-center">
              <Dumbbell className="h-12 w-12 animate-bounce" style={{ color: primaryColor }} />
            </div>
          </div>
        </div>

        {/* Animated Brand Text & Spinner in selected color shade */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-wider uppercase font-display bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            {gymName}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: primaryColor }} />
            <span style={{ color: primaryColor }}>Loading...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
