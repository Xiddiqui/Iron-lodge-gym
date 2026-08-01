'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export function useGymSettings() {
  return useQuery({
    queryKey: ['gym-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('gym_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      return data;
    },
  });
}
