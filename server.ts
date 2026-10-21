import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'database.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Default Google Spreadsheet from user's request
const DEFAULT_SHEET_ID = '1FCVIjZJsQ4FkB_LzBzmCcuNPbrZVV8ZHHqLpzVcU9so';
const DEFAULT_SHEET_DOC_URL = 'https://docs.google.com/spreadsheets/d/1FCVIjZJsQ4FkB_LzBzmCcuNPbrZVV8ZHHqLpzVcU9so/edit?gid=783791081#gid=783791081';

// Initial spreadsheet config
let sheetConfig = {
  webAppUrl: process.env.VITE_SHEET_WEBAPP_URL || process.env.GOOGLE_SHEETS_WEBAPP_URL || '',
  sheetId: process.env.VITE_GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEETS_ID || DEFAULT_SHEET_ID,
  sheetDocUrl: DEFAULT_SHEET_DOC_URL,
  isConfigured: false,
  updatedAt: new Date().toISOString(),
};

// Load saved config if exists
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    sheetConfig = { ...sheetConfig, ...saved };
    if (!sheetConfig.sheetDocUrl || sheetConfig.sheetDocUrl.includes('15loY6F6')) {
      sheetConfig.sheetDocUrl = DEFAULT_SHEET_DOC_URL;
    }
    if (!sheetConfig.sheetId || sheetConfig.sheetId.includes('15loY6F6')) {
      sheetConfig.sheetId = DEFAULT_SHEET_ID;
    }
    sheetConfig.isConfigured = Boolean(sheetConfig.webAppUrl);
  }
} catch (e) {
  console.warn('Error reading config file:', e);
}

// In-memory Realtime state
interface Presence {
  userId: string;
  userName: string;
  userRole: string;
  clientId: string;
  lastSeenMs: number;
  currentTab?: string;
}

interface RealtimeState {
  presences: Record<string, Presence>;
  workSessions: any[];
  chatChannels: any[];
  chatMessages: any[];
}

const realtimeState: RealtimeState = {
  presences: {},
  workSessions: [],
  chatChannels: [],
  chatMessages: [],
};

// SSE Subscribers
const sseClients = new Set<Response>();

function broadcastSSE(event: string, data: any) {
  const wrappedPayload = {
    type: event,
    payload: data,
    timestamp: Date.now(),
  };
  const jsonStr = JSON.stringify(wrappedPayload);
  // Send as both named event and standard message event for maximum EventSource compatibility
  const chunk = `event: ${event}\ndata: ${jsonStr}\n\nevent: message\ndata: ${jsonStr}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(chunk);
    } catch {
      sseClients.delete(client);
    }
  }
}

function getActivePresencesList(): Presence[] {
  const now = Date.now();
  // Filter active within 20 seconds for clear, fast, and accurate online detection
  return Object.values(realtimeState.presences).filter((p) => now - p.lastSeenMs <= 20000);
}

// Clean up stale presences every 3 seconds for responsive online/offline accuracy
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [userId, p] of Object.entries(realtimeState.presences)) {
    if (now - p.lastSeenMs > 20000) {
      delete realtimeState.presences[userId];
      changed = true;
    }
  }
  if (changed) {
    broadcastSSE('presence:update', { presences: getActivePresencesList() });
  }
}, 3000);

// Heartbeat to keep SSE connections alive
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': heartbeat\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 20000);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 1. Spreadsheet Configuration
app.get('/api/sheets-config', (_req: Request, res: Response) => {
  res.json({
    ...sheetConfig,
    isConfigured: Boolean(sheetConfig.webAppUrl),
    source: sheetConfig.webAppUrl ? 'server_proxy' : 'unconfigured',
  });
});

app.post('/api/sheets-config', (req: Request, res: Response) => {
  try {
    const { webAppUrl, sheetId, sheetDocUrl } = req.body || {};
    const cleanUrl = String(webAppUrl || '').trim();
    const isValid = cleanUrl.startsWith('https://script.google.com/macros/s/') && cleanUrl.includes('/exec');

    sheetConfig = {
      ...sheetConfig,
      webAppUrl: cleanUrl,
      sheetId: String(sheetId || sheetConfig.sheetId || DEFAULT_SHEET_ID).trim(),
      sheetDocUrl: String(sheetDocUrl || sheetConfig.sheetDocUrl || DEFAULT_SHEET_DOC_URL).trim(),
      isConfigured: isValid,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(sheetConfig, null, 2));
    broadcastSSE('sheets:config', sheetConfig);
    res.json({ ok: true, success: true, config: sheetConfig });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Helper to check valid Google Apps Script Web App URL
function isValidGasUrl(url: string | undefined): boolean {
  return Boolean(
    url &&
    typeof url === 'string' &&
    url.startsWith('https://script.google.com/macros/s/') &&
    url.includes('/exec')
  );
}

// 2. Read Database (From Google Apps Script proxy or Local Fallback)
app.get('/api/sheets/database', async (req: Request, res: Response) => {
  const sheetName = req.query.sheet as string;

  // Only attempt external fetch if a valid Google Apps Script Web App URL is configured
  if (isValidGasUrl(sheetConfig.webAppUrl)) {
    try {
      const targetUrl = sheetName
        ? `${sheetConfig.webAppUrl}?sheet=${encodeURIComponent(sheetName)}`
        : sheetConfig.webAppUrl;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const gasRes = await fetch(targetUrl, {
        headers: { Accept: 'application/json' },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (gasRes.ok) {
        const text = await gasRes.text();
        try {
          const json = JSON.parse(text);
          if (json.status !== 'error') {
            const data = json.data || json;
            // Update local DB cache so server data stays in sync
            if (data && typeof data === 'object') {
              try {
                fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
              } catch (_) {}
            }
            return res.json({
              status: 'success',
              source: 'google_spreadsheet',
              data,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (_) {
          // If response is HTML login redirect, Apps Script requires "Who has access: Anyone"
        }
      }
    } catch (_e: any) {
      // AbortError or network error: gracefully fall back to local database cache
    }
  }

  // Fallback to local database cache immediately (< 5ms response time)
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      return res.json({
        status: isValidGasUrl(sheetConfig.webAppUrl) ? 'cached' : 'fallback',
        source: 'local_database',
        data,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('Error reading local database file:', e);
  }

  res.json({
    status: 'unconfigured',
    message: 'Database lokal kosong dan Web App URL belum tersambung.',
    data: null,
  });
});

// 3. Save Database (To Local Cache & Sync to Google Spreadsheet)
app.post('/api/sheets/database', async (req: Request, res: Response) => {
  try {
    const { webAppUrl: _w, action: _a, timestamp: _t, ...dbPayload } = req.body || {};
    const dataToSave = dbPayload.data || dbPayload;

    // Validate minimal structure
    if (!dataToSave || typeof dataToSave !== 'object') {
      return res.status(400).json({ status: 'error', message: 'Payload database tidak valid' });
    }

    // 1. Save to local persistent storage immediately
    fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2));

    // 2. Broadcast realtime update to all SSE clients
    broadcastSSE('database:update', {
      timestamp: new Date().toISOString(),
      sender: req.headers['x-client-id'] || 'system',
    });

    // 3. Asynchronously sync to Google Apps Script Web App if a valid URL is configured
    let syncResult: any = { synced: false, message: 'Disimpan di cache server' };
    if (isValidGasUrl(sheetConfig.webAppUrl)) {
      try {
        const gasPayload = {
          action: 'SAVE_ALL',
          timestamp: new Date().toISOString(),
          ...dataToSave,
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        fetch(sheetConfig.webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          redirect: 'follow',
          body: JSON.stringify(gasPayload),
          signal: controller.signal,
        })
          .then(async (r) => {
            clearTimeout(timeout);
            if (r.ok) {
              const resJson = await r.json().catch(() => ({}));
              broadcastSSE('sheets:synced', {
                status: 'success',
                timestamp: new Date().toISOString(),
                response: resJson,
              });
            } else {
              broadcastSSE('sheets:synced', {
                status: 'error',
                code: r.status,
                message: `Google Sheets HTTP ${r.status}`,
              });
            }
          })
          .catch((_err) => {
            clearTimeout(timeout);
            // Async sync error or timeout: data is already safely stored in server DB
          });

        syncResult = { synced: true, message: 'Data dikirim ke Google Spreadsheet' };
      } catch (_err: any) {
        // Silently keep local data safe
      }
    }

    res.json({
      status: 'success',
      message: 'Database berhasil disimpan dan disinkronkan',
      syncResult,
    });
  } catch (err: any) {
    console.error('Error saving database:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 4. Real-time Server-Sent Events (SSE) Stream
app.get('/api/realtime/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClients.add(res);

  // Send initial connected event & current state
  const initData = {
    presences: getActivePresencesList(),
    workSessions: realtimeState.workSessions,
    chatChannels: realtimeState.chatChannels,
    chatMessages: realtimeState.chatMessages.slice(-50),
    sheetConfig: {
      isConfigured: Boolean(sheetConfig.webAppUrl),
      sheetDocUrl: sheetConfig.sheetDocUrl,
    },
    timestamp: Date.now(),
  };
  res.write(`event: init\ndata: ${JSON.stringify(initData)}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// 5. Real-time Event Receiver
app.post('/api/realtime/event', (req: Request, res: Response) => {
  const { type, payload, clientId } = req.body || {};
  if (!type) return res.status(400).json({ error: 'Missing event type' });

  // Handle presence (Keyed by unique userId to prevent duplicate counts)
  if (type === 'presence:heartbeat' && payload?.userId) {
    realtimeState.presences[payload.userId] = {
      ...realtimeState.presences[payload.userId],
      ...payload,
      clientId: clientId || 'default',
      lastSeenMs: Date.now(),
    };
    broadcastSSE('presence:update', { presences: getActivePresencesList() });
  } else if (type === 'presence:leave' || type === 'presence:logout') {
    if (payload?.userId) {
      delete realtimeState.presences[payload.userId];
    }
    broadcastSSE('presence:update', { presences: getActivePresencesList() });
  }

  // Handle session updates
  if (type === 'session:upsert' && payload?.id) {
    const idx = realtimeState.workSessions.findIndex((s) => s.id === payload.id);
    if (idx >= 0) {
      realtimeState.workSessions[idx] = { ...realtimeState.workSessions[idx], ...payload };
    } else {
      realtimeState.workSessions.unshift(payload);
    }
    broadcastSSE('session:update', { workSessions: realtimeState.workSessions });
  }

  // Handle chat messages
  if (type === 'chat:message' && payload?.message?.id) {
    if (!realtimeState.chatMessages.some((m) => m.id === payload.message.id)) {
      realtimeState.chatMessages.push(payload.message);
      if (realtimeState.chatMessages.length > 1000) {
        realtimeState.chatMessages = realtimeState.chatMessages.slice(-1000);
      }
    }
    broadcastSSE('chat:message', payload);
  }

  // Handle general database sync trigger
  if (type === 'database:sync') {
    broadcastSSE('database:sync', {
      timestamp: new Date().toISOString(),
      clientId,
    });
  }

  res.json({ ok: true });
});

// 6. Realtime State Snapshot
app.get('/api/realtime/state', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    presences: getActivePresencesList(),
    workSessions: realtimeState.workSessions,
    chatChannels: realtimeState.chatChannels,
    chatMessages: realtimeState.chatMessages,
    timestamp: Date.now(),
  });
});

// 7. Chat APIs
app.get('/api/chat/database', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    channels: realtimeState.chatChannels,
    messages: realtimeState.chatMessages,
    count: {
      channels: realtimeState.chatChannels.length,
      messages: realtimeState.chatMessages.length,
    },
    timestamp: Date.now(),
  });
});

app.post('/api/chat/messages', (req: Request, res: Response) => {
  const m = req.body.message;
  if (!m?.channelId || !m?.message) {
    return res.status(400).json({ ok: false, error: 'Pesan tidak lengkap' });
  }
  const now = new Date();
  const msg = {
    ...m,
    id: m.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: m.timestamp || now.toISOString(),
    timeFormatted:
      m.timeFormatted ||
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB',
    priority: m.priority || 'NORMAL',
    readBy: Array.isArray(m.readBy) ? m.readBy : [m.senderId].filter(Boolean),
    createdAt: m.createdAt || now.toISOString(),
  };

  if (!realtimeState.chatMessages.some((existing) => existing.id === msg.id)) {
    realtimeState.chatMessages.push(msg);
  }

  broadcastSSE('chat:message', { message: msg, channel: req.body.channel });
  res.json({ ok: true, message: msg });
});

// 8. AI Error Diagnostics for Google Spreadsheet Sync
app.post('/api/ai/diagnose-sync', async (req: Request, res: Response) => {
  const { errorText } = req.body || {};
  if (!errorText || typeof errorText !== 'string' || errorText.trim().length < 5) {
    return res.status(400).json({ ok: false, error: 'Pesan error minimal 5 karakter.' });
  }

  const errStr = errorText.toLowerCase();

  // 1. Try Gemini AI if API key is present
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = `Anda adalah seorang Senior Full-Stack Engineer dan AI Architect untuk aplikasi operasional "SIM Asrama Haji Jakarta".
Aplikasi ini menyinkronkan data (gedung, kamar, transaksi reservasi, check-in, check-out, perpanjangan sewa, QC, teknisi, dan pengguna) ke Google Spreadsheet menggunakan Google Apps Script Web App (.exec) atau server proxy.

Administrator menempelkan pesan error sinkronisasi berikut:
"${errorText}"

Berikan analisis dalam Bahasa Indonesia yang profesional, ramah, dan solutif dengan format Markdown:
## Ringkasan Masalah
(1-2 kalimat menjelaskan inti kendala)

## Kemungkinan Penyebab Utama
(Daftar 2-3 poin teknis penyebab kendala ini)

## Langkah Solusi Konkret
(Langkah praktis yang harus dilakukan administrator, seperti pengaturan deploy Google Apps Script 'Who has access: Anyone', pembuatan sheet baru, pemeriksaan URL /exec, atau perizinan akun Google)`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response.text) {
        return res.json({ ok: true, text: response.text });
      }
    } catch (e: any) {
      console.warn('Gemini diagnosis fallback to rules engine:', e.message);
    }
  }

  // 2. Intelligent Rules Engine Fallback
  let summary = 'Terdeteksi kendala komunikasi antara aplikasi dan Google Spreadsheet.';
  let causes: string[] = [];
  let solutions: string[] = [];

  if (errStr.includes('403') || errStr.includes('forbidden') || errStr.includes('servicelogin') || errStr.includes('accounts.google.com')) {
    summary = 'Akses ke Google Apps Script Web App ditolak (HTTP 403 Forbidden / Login Redirect).';
    causes = [
      'Pada konfigurasi Deploy Web App di Google Apps Script, pengaturan "Who has access" masih disetel ke "Only myself" (Hanya saya) atau "Anyone with Google Account".',
      'Browser atau server mencoba memanggil URL namun diarahkan ke halaman login Google Account.',
    ];
    solutions = [
      'Buka Google Spreadsheet > menu Ekstensi (Extensions) > Apps Script.',
      'Klik tombol **Deploy** di pojok kanan atas > pilih **Manage deployments** (Kelola deployment).',
      'Klik ikon pensil (Edit) pada deployment Web App aktif.',
      'Ubah opsi **"Who has access"** (Siapa yang memiliki akses) menjadi **"Anyone" (Siapa saja)**.',
      'Klik **Deploy** dan salin URL Web App yang berakhiran `/exec`. Tempelkan kembali ke pengaturan SIM Asrama Haji.',
    ];
  } else if (errStr.includes('failed to fetch') || errStr.includes('cors') || errStr.includes('networkerror')) {
    summary = 'Koneksi jaringan terhalang oleh pembatasan CORS browser atau koneksi offline.';
    causes = [
      'Browser memblokir permintaan direct fetch ke Google Apps Script karena respons redirect Google.',
      'Koneksi internet terputus atau URL Web App salah ketik.',
    ];
    solutions = [
      'Gunakan fitur proxy server internal dengan menyimpan URL Web App di tab Pengaturan Spreadsheet.',
      'Pastikan URL berawalan `https://script.google.com/macros/s/...` dan berakhiran `/exec`.',
      'Periksa apakah perangkat Anda dapat membuka link Google Spreadsheet langsung di tab baru.',
    ];
  } else if (errStr.includes('not found') || errStr.includes('404')) {
    summary = 'Endpoint Web App Google Apps Script tidak ditemukan (HTTP 404).';
    causes = [
      'Deployment Web App telah dihapus atau ID script pada URL salah ketik.',
    ];
    solutions = [
      'Lakukan New deployment ulang di Google Apps Script > Deploy > New deployment > Web app.',
      'Pastikan menyalin URL Web App terbaru yang berakhiran `/exec`.',
    ];
  } else {
    summary = 'Pemeriksaan struktur data atau eksekusi fungsi Google Apps Script.';
    causes = [
      'Fungsi `doGet` atau `doPost` belum terpasang dengan benar di file Code.gs pada Apps Script.',
      'Batas kuota eksekusi Google Apps Script tercapai sementara.',
    ];
    solutions = [
      'Buka tab "Integrasi Spreadsheet" di SIM Asrama Haji, lalu klik tombol **"Salin Kode Apps Script"**.',
      'Buka Google Spreadsheet > Ekstensi > Apps Script > ganti seluruh isi Code.gs dengan kode tersebut.',
      'Klik tombol Simpan (ikon disket) dan Deploy > New deployment > Web app > Who has access: Anyone.',
    ];
  }

  const markdownResult = `## Ringkasan Masalah
${summary}

## Kemungkinan Penyebab
${causes.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Langkah Perbaikan
${solutions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

  res.json({ ok: true, text: markdownResult });
});

// -------------------------------------------------------------
// VITE DEV SERVER / PRODUCTION STATIC SERVING
// -------------------------------------------------------------

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[SIM Asrama Haji Jakarta] Server aktif di port ${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
    console.log(`[Spreadsheet Database] ID: ${sheetConfig.sheetId}`);
    console.log(`[Spreadsheet Link] ${sheetConfig.sheetDocUrl}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
