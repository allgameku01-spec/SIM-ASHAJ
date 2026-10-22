import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase configuration
const rawEnvUrl = 
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  '';

const rawEnvKey = 
  (typeof import.meta !== 'undefined' && ((import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY)) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  '';

// Default project fallback
const defaultFallbackUrl = 'https://okadqywvaqcgeasjfpno.supabase.co/rest/v1/';
const defaultFallbackKey = 'sb_publishable_ACSn1XC_DbNU5Kf3Q03t4A_P4TMEKBF';

export function sanitizeSupabaseUrl(url?: string): string {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

let activeUrl = sanitizeSupabaseUrl(rawEnvUrl || defaultFallbackUrl);
let activeKey = (rawEnvKey || defaultFallbackKey || '').trim();

let clientInstance: SupabaseClient = createClient(activeUrl, activeKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-application-name': 'sim-asrama-haji-jakarta' }
  }
});

/**
 * Mendapatkan status konfigurasi Supabase saat ini
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(activeUrl && activeKey && activeUrl.startsWith('https://') && activeUrl.includes('.supabase.co'));
}

export function getSupabaseConfig(): {
  url: string;
  host: string;
  isConfigured: boolean;
  hasCustomCredentials: boolean;
} {
  let host = activeUrl;
  try {
    host = new URL(activeUrl).host;
  } catch {
    host = activeUrl.replace(/^https?:\/\//, '').split('/')[0];
  }

  return {
    url: activeUrl,
    host,
    isConfigured: isSupabaseConfigured(),
    hasCustomCredentials: Boolean(rawEnvUrl && rawEnvKey)
  };
}

/**
 * Reconfigures client dynamically
 */
export function reconfigureSupabase(newUrl: string, newKey: string): SupabaseClient {
  activeUrl = sanitizeSupabaseUrl(newUrl);
  activeKey = newKey.trim();
  clientInstance = createClient(activeUrl, activeKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-application-name': 'sim-asrama-haji-jakarta' }
    }
  });
  return clientInstance;
}

/**
 * Klien Supabase singleton dinamis
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const val = (clientInstance as any)[prop];
    return typeof val === 'function' ? val.bind(clientInstance) : val;
  }
});

export default supabase;
