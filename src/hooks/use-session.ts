'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      return error ? null : data.user;
    },
    staleTime: 0,
  });
}
