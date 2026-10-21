import { useEffect, useState } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';

type Mirror = { url?: string; lastSyncAt?: string; lastError?: string; ok?: boolean; error?: string };

export function SheetMirrorPanel() {
  const [mirror, setMirror] = useState<Mirror | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/sheets/mirror').then(async response => {
      if (!response.ok) throw new Error('Status spreadsheet belum dapat dibaca.');
      return response.json();
    }).then(value => { if (active) setMirror(value); }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);

  async function sync() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/sheets/mirror', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const result: Mirror = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Sinkronisasi gagal.');
      setMirror(result);
      setMessage('Data tersimpan berhasil disalin ke spreadsheet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sinkronisasi gagal.');
    } finally { setBusy(false); }
  }

  return (
    <section className="border-b border-slate-200 py-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Salinan Google Sheets</h2>
        <div className="flex flex-wrap gap-2">
          {mirror?.url && (
            <a
              href={mirror.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition"
            >
              <ExternalLink className="size-4" />
              Buka salinan spreadsheet
            </a>
          )}
          <button
            type="button"
            onClick={sync}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50 transition"
          >
            <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Menyinkronkan…' : 'Sinkronkan sekarang'}
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-500">
        Terakhir disalin: {mirror?.lastSyncAt ? new Date(mirror.lastSyncAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'Belum tersedia'}
      </p>
      {(message || mirror?.lastError) && (
        <p role="status" className="text-sm text-slate-700 break-words">{message || mirror?.lastError}</p>
      )}
    </section>
  );
}