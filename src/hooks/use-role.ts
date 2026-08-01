'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useCurrentUser } from './use-session';

export function useRole() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ['my-role', user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always' as const,
    queryFn: async () => {
      const { data } = await supabase.rpc('get_my_role');
      return data as 'admin' | 'staff' | null;
    },
  });
}
