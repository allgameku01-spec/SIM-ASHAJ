import { useState } from "react";

function renderMarkdown(md: string) {
  return md.split("\n").map((line, i) => {
    const t = line.trim();
    if (t.startsWith("#")) {
      return <h4 key={i} className="mt-3 font-bold text-amber-800 text-sm">{t.replace(/^#+\s*/, "")}</h4>;
    }
    if (!t) return <div key={i} className="h-1" />;
    const html = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code class='bg-amber-100 px-1 py-0.5 rounded text-amber-900'>$1</code>");
    return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: html.replace(/<(?!\/?(strong|code|span)>)/g, "&lt;") }} />;
  });
}

export function SyncErrorAssistant() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const res = await fetch("/api/ai/diagnose-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorText: text }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAnswer(data.text);
      } else {
        setError(data.error || "Gagal mendapatkan analisis AI. Silakan coba lagi.");
      }
    } catch {
      setError("Permintaan gagal terhubung ke server. Periksa koneksi dan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <i className="fa-solid fa-wand-magic-sparkles text-amber-600"></i>
        <h3 className="font-bold text-slate-800">Asisten AI: Analisis Error Sinkronisasi</h3>
      </div>
      <p className="text-slate-500 text-xs">
        Tempel pesan error sinkronisasi Google Spreadsheet. Sistem akan menjelaskan kemungkinan penyebab dan langkah perbaikan teknis yang tepat.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={12000}
        placeholder="Contoh: HTTP 403 Forbidden: Akses ditolak oleh Google Apps Script..."
        className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading || text.trim().length < 5}
          onClick={run}
          className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <i className="fa-solid fa-spinner animate-spin"></i>
              <span>Menganalisis…</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-microchip"></i>
              <span>Analisis Error</span>
            </>
          )}
        </button>
        {text && (
          <button
            type="button"
            onClick={() => { setText(""); setAnswer(""); setError(""); }}
            className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800"
          >
            Bersihkan
          </button>
        )}
      </div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-red-700 text-xs">{error}</div>}
      {answer && (
        <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4 text-xs text-slate-700 space-y-1.5 leading-relaxed">
          {renderMarkdown(answer)}
        </div>
      )}
    </div>
  );
}
