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
      const mergedTheme = { ...defaultLandingPageData.theme, ...(savedData.theme || {}) };

      if (mergedTheme.primaryColor && typeof window !== 'undefined') {
        try { localStorage.setItem('gym_primary_color', mergedTheme.primaryColor); } catch {}
      }

      // Ensure any missing sections from defaults are included in sectionOrder
      const savedOrder = savedData.sectionOrder || defaultLandingPageData.sectionOrder || [];
      const defaultOrder = defaultLandingPageData.sectionOrder || [];
      const completeOrder = Array.from(new Set([...savedOrder, ...defaultOrder]));

      return {
        theme: mergedTheme,
        hero: { ...defaultLandingPageData.hero, ...(savedData.hero || {}) },
        about: { ...defaultLandingPageData.about, ...(savedData.about || {}) },
        features: savedData.features || defaultLandingPageData.features,
        schedule: { ...defaultLandingPageData.schedule!, ...(savedData.schedule || {}) },
        video: { ...defaultLandingPageData.video!, ...(savedData.video || {}) },
        pricing: savedData.pricing || defaultLandingPageData.pricing,
        trainers: savedData.trainers || defaultLandingPageData.trainers,
        gallery: savedData.gallery || defaultLandingPageData.gallery,
        testimonials: savedData.testimonials || defaultLandingPageData.testimonials,
        faq: { ...defaultLandingPageData.faq!, ...(savedData.faq || {}) },
        cta: { ...defaultLandingPageData.cta!, ...(savedData.cta || {}) },
        customBlocks: savedData.customBlocks || [],
        contact: { ...defaultLandingPageData.contact, ...(savedData.contact || {}) },
        sections: { ...defaultLandingPageData.sections, ...(savedData.sections || {}) },
        sectionOrder: completeOrder,
        seo: { ...defaultLandingPageData.seo, ...(savedData.seo || {}) },
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
      if (newData.theme?.primaryColor && typeof window !== 'undefined') {
        try { localStorage.setItem('gym_primary_color', newData.theme.primaryColor); } catch {}
      }
      return newData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-page-settings'] });
      queryClient.invalidateQueries({ queryKey: ['gym-settings'] });
    },
  });
}
