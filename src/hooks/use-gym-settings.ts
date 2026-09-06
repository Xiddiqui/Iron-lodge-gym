'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export function useGymSettings() {
  return useQuery({
    queryKey: ['gym-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('gym_settings')
        .select('id, gym_name, logo_url, currency, timezone, reserve_percentage, created_at, updated_at')
        .eq('id', 1)
        .maybeSingle();
      return data;
    },
  });
}
