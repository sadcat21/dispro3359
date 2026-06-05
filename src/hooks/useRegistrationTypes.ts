import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const REGISTRATION_TYPES_KEY = 'registration_types';

export interface RegistrationTypeEntry {
  ar: string;
  fr: string;
  en: string;
  short?: string;
  description?: string;
  bg_color?: string;
  text_color?: string;
}

const DEFAULT_TYPES: RegistrationTypeEntry[] = [
  { ar: 'شخص طبيعي', fr: 'Personne Physique', en: 'Individual', short: 'PP', bg_color: '#15803d', text_color: '#ffffff' },
  { ar: 'EURL', fr: 'EURL', en: 'EURL', short: 'EURL', bg_color: '#1d4ed8', text_color: '#ffffff' },
  { ar: 'SARL', fr: 'SARL', en: 'SARL', short: 'SARL', bg_color: '#7c3aed', text_color: '#ffffff' },
  { ar: 'SPA', fr: 'SPA', en: 'SPA', short: 'SPA', bg_color: '#be123c', text_color: '#ffffff' },
  { ar: 'SNC', fr: 'SNC', en: 'SNC', short: 'SNC', bg_color: '#b45309', text_color: '#ffffff' },
];

const FALLBACK_COLORS = ['#0e7490', '#0f766e', '#c2410c', '#4338ca', '#4d7c0f', '#9f1239'];

export const getRegistrationTypeColor = (
  index = 0,
  entry?: RegistrationTypeEntry,
): { bg: string; text: string } => {
  if (entry?.bg_color) {
    return { bg: entry.bg_color, text: entry.text_color || '#ffffff' };
  }
  return { bg: FALLBACK_COLORS[index % FALLBACK_COLORS.length], text: '#ffffff' };
};

export const useRegistrationTypes = () => {
  const queryClient = useQueryClient();

  const { data: registrationTypes = [], isLoading } = useQuery({
    queryKey: ['registration-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', REGISTRATION_TYPES_KEY)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_TYPES;
      try {
        return JSON.parse(data.value) as RegistrationTypeEntry[];
      } catch {
        return DEFAULT_TYPES;
      }
    },
  });

  const updateTypes = useMutation({
    mutationFn: async (types: RegistrationTypeEntry[]) => {
      const value = JSON.stringify(types);
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', REGISTRATION_TYPES_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', REGISTRATION_TYPES_KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({ key: REGISTRATION_TYPES_KEY, value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration-types'] });
    },
  });

  return { registrationTypes, isLoading, updateTypes };
};
