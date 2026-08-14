'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { LandingPageData, defaultLandingPageData } from '@/types/landing-page';

export function useLandingPageSettings() {
  return useQuery({
    queryKey: ['landing-page-settings'],
    queryFn: async (): Promise<LandingPageData> => {
      const { data, error } = await supabase
        .from('gym_settings')
        .select('gym_name, logo_url, landing_page_data')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching landing page settings:', error);
        return defaultLandingPageData;
      }

      if (!data || !data.landing_page_data) {
        return defaultLandingPageData;
      }

      // Merge saved DB landing page data with default values to ensure no missing keys
      const savedData = data.landing_page_data as Partial<LandingPageData>;
      return {
        theme: { ...defaultLandingPageData.theme, ...(savedData.theme || {}) },
        hero: { ...defaultLandingPageData.hero, ...(savedData.hero || {}) },
        about: { ...defaultLandingPageData.about, ...(savedData.about || {}) },
        features: savedData.features || defaultLandingPageData.features,
        pricing: savedData.pricing || defaultLandingPageData.pricing,
        trainers: savedData.trainers || defaultLandingPageData.trainers,
        gallery: savedData.gallery || defaultLandingPageData.gallery,
        testimonials: savedData.testimonials || defaultLandingPageData.testimonials,
        contact: { ...defaultLandingPageData.contact, ...(savedData.contact || {}) },
        sections: { ...defaultLandingPageData.sections, ...(savedData.sections || {}) },
      };
    },
  });
}

export function useUpdateLandingPageSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newData: LandingPageData) => {
      const { error } = await supabase
        .from('gym_settings')
        .update({
          landing_page_data: newData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      if (error) throw error;
      return newData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-page-settings'] });
      queryClient.invalidateQueries({ queryKey: ['gym-settings'] });
    },
  });
}
