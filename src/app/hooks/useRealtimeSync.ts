// @ts-nocheck
import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../integrations/supabase/client';

export interface RealtimeSyncOptions {
  table?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  enabled?: boolean;
}

/**
 * Custom hook untuk mendengarkan perubahan tabel secara real-time dari Supabase
 * Dioptimalkan untuk efisiensi egress dengan selective channels dan filter kolom/tabel.
 * 
 * @param onDataChanged Callback yang dipanggil saat ada event Postgres
 * @param optionsOrTable Nama tabel (string) atau objek RealtimeSyncOptions
 */
export function useRealtimeSync(
  onDataChanged: (payload: any) => void,
  optionsOrTable?: string | RealtimeSyncOptions
) {
  const callbackRef = useRef(onDataChanged);
  callbackRef.current = onDataChanged;

  const options: RealtimeSyncOptions = typeof optionsOrTable === 'string'
    ? { table: optionsOrTable }
    : (optionsOrTable || {});

  const {
    table,
    event = '*',
    filter,
    enabled = true
  } = options;

  useEffect(() => {
    // Hindari membuka koneksi jika Supabase belum dikonfigurasi atau disabled
    if (!enabled || !isSupabaseConfigured()) {
      return;
    }

    const uniqueId = Math.random().toString(36).substring(2, 7);
    const channelName = table 
      ? `realtime-opt-${table}-${event.toLowerCase()}-${uniqueId}`
      : `realtime-opt-core-${uniqueId}`;

    const filterConfig: any = {
      event,
      schema: 'public',
    };

    if (table) {
      filterConfig.table = table;
    }
    if (filter) {
      filterConfig.filter = filter;
    }

    let channel: any = null;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          filterConfig,
          (payload) => {
            if (callbackRef.current) {
              callbackRef.current(payload);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Berhasil tersambung ke channel realtime yang ditargetkan
          }
        });
    } catch (err) {
      console.warn('[useRealtimeSync] Gagal inisialisasi channel Supabase:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      }
    };
  }, [table, event, filter, enabled]);
}

export default useRealtimeSync;
