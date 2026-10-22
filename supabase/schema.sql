-- ==============================================================================
-- SKEMA BASIS DATA SUPABASE (POSTGRESQL) - SIM ASRAMA HAJI JAKARTA
-- Dioptimalkan untuk efisiensi egress, kecepatan pembacaan, dan integritas data
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL PENGATURAN INSTANSI & KOP SURAT (app_settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    organization_name TEXT NOT NULL DEFAULT 'ASRAMA HAJI JAKARTA',
    sub_title TEXT NOT NULL DEFAULT 'SIM - Sistem Informasi Manajemen',
    ministry_name TEXT NOT NULL DEFAULT 'KEMENTERIAN HAJI DAN UMRAH REPUBLIK INDONESIA',
    address TEXT NOT NULL DEFAULT 'Jl. Raya Pd. Gede, RT.1/RW.1, Pinang Ranti, Kec. Makasar, Kota Jakarta Timur, DKI Jakarta 13560',
    phone TEXT NOT NULL DEFAULT '0816243154',
    email TEXT NOT NULL DEFAULT 'info@asramahajijakarta.id',
    portal_url TEXT NOT NULL DEFAULT 'https://asramahajijakarta.id',
    app_logo TEXT,
    app_favicon TEXT DEFAULT '/logo.png',
    tag_title TEXT DEFAULT 'SIM - Asrama Haji Jakarta',
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 3. TABEL PENGGUNA / PETUGAS (users)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Resepsionis',
    password TEXT NOT NULL DEFAULT '12345',
    department TEXT NOT NULL DEFAULT 'Operasional',
    supervisor_id TEXT,
    assigned_building TEXT DEFAULT 'Semua Gedung',
    phone TEXT DEFAULT '-',
    status TEXT DEFAULT 'Aktif',
    email TEXT,
    nip TEXT,
    is_owner BOOLEAN DEFAULT FALSE,
    signature_url TEXT,
    qr_code_url TEXT,
    signature_history JSONB DEFAULT '[]'::jsonb,
    security_question TEXT,
    security_answer_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 4. TABEL GEDUNG (buildings)
CREATE TABLE IF NOT EXISTS public.buildings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    floors INTEGER DEFAULT 1,
    total_rooms INTEGER DEFAULT 0,
    capacity_desc TEXT,
    category TEXT DEFAULT 'PENGINAPAN',
    description TEXT,
    status TEXT DEFAULT 'AKTIF',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 5. TABEL KAMAR (rooms)
CREATE TABLE IF NOT EXISTS public.rooms (
    id TEXT PRIMARY KEY,
    room_number TEXT NOT NULL,
    building TEXT NOT NULL,
    floor INTEGER DEFAULT 1,
    type TEXT NOT NULL DEFAULT 'Standard',
    bed_type TEXT,
    capacity TEXT DEFAULT '2 Orang',
    capacity_number INTEGER DEFAULT 2,
    price_per_night NUMERIC(12, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'KOSONG',
    active_tx_id TEXT,
    active_maint_id TEXT,
    qc_status TEXT DEFAULT 'LOLOS_QC',
    last_qc_date TIMESTAMPTZ,
    last_qc_by TEXT,
    last_qc_notes TEXT,
    facilities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 6. TABEL AULA & RUANG PERTEMUAN (meeting_rooms)
CREATE TABLE IF NOT EXISTS public.meeting_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    category TEXT DEFAULT 'SERBAGUNA',
    building TEXT DEFAULT 'Kompleks Ruang Pertemuan',
    capacity TEXT,
    capacity_number INTEGER DEFAULT 50,
    facilities JSONB DEFAULT '[]'::jsonb,
    daily_rate NUMERIC(12, 2) DEFAULT 0,
    session_rate NUMERIC(12, 2) DEFAULT 0,
    description TEXT,
    status TEXT DEFAULT 'TERSEDIA',
    qc_status TEXT DEFAULT 'LOLOS_QC',
    active_tx_id TEXT,
    active_maint_id TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 7. TABEL TARIF & KAPASITAS KAMAR (room_capacity_rates)
CREATE TABLE IF NOT EXISTS public.room_capacity_rates (
    id TEXT PRIMARY KEY,
    room_type TEXT NOT NULL,
    bed_type TEXT NOT NULL,
    capacity_pax INTEGER NOT NULL DEFAULT 1,
    price_per_night NUMERIC(12, 2) NOT NULL DEFAULT 0,
    description TEXT,
    facilities JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 8. TABEL TRANSAKSI & RESERVASI (transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    room_id TEXT,
    room_number TEXT,
    building TEXT,
    category TEXT DEFAULT 'PENGINAPAN',
    guest_name TEXT NOT NULL,
    guest_type TEXT DEFAULT 'INDIVIDU',
    nik_ktp TEXT,
    kloter TEXT,
    start_date DATE NOT NULL,
    duration INTEGER NOT NULL DEFAULT 1,
    phone TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'AKTIF',
    created_user TEXT DEFAULT 'System',
    is_group BOOLEAN DEFAULT FALSE,
    group_type TEXT,
    group_name TEXT,
    group_pic TEXT,
    group_pic_phone TEXT,
    group_id TEXT,
    total_pax INTEGER,
    include_aula BOOLEAN DEFAULT FALSE,
    rent_aula_id TEXT,
    rent_aula_name TEXT,
    rent_aula_duration INTEGER,
    rent_aula_duration_days INTEGER,
    rent_aula_session TEXT,
    catering_package TEXT,
    catering_pax_count INTEGER,
    agency_or_document TEXT,
    spk_number TEXT,
    allocated_room_numbers JSONB DEFAULT '[]'::jsonb,
    allocated_rooms_count INTEGER,
    breakfast BOOLEAN DEFAULT FALSE,
    breakfast_menu TEXT,
    breakfast_portions INTEGER,
    breakfast_days INTEGER,
    breakfast_status TEXT,
    rent_type TEXT DEFAULT 'Harian',
    duration_unit TEXT DEFAULT 'Hari',
    price_per_night NUMERIC(12, 2) DEFAULT 0,
    extra_bed BOOLEAN DEFAULT FALSE,
    extra_bed_count INTEGER DEFAULT 0,
    extra_bed_price NUMERIC(12, 2) DEFAULT 0,
    extra_bed_notes TEXT,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    payment_status TEXT DEFAULT 'BELUM_LUNAS',
    paid_amount NUMERIC(12, 2) DEFAULT 0,
    dp_amount NUMERIC(12, 2) DEFAULT 0,
    dp_date DATE,
    dp_method TEXT,
    dp_note TEXT,
    remaining_amount NUMERIC(12, 2) DEFAULT 0,
    va_number TEXT,
    va_account_name TEXT,
    bank_name TEXT,
    bank_account_number TEXT,
    payment_method TEXT,
    payment_date DATE,
    payment_note TEXT,
    kwitansi_no TEXT,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    cancelled_user TEXT,
    extended_count INTEGER DEFAULT 0,
    extend_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 9. TABEL MAINTENANCE / PERAWATAN & TEKNISI (maintenances)
CREATE TABLE IF NOT EXISTS public.maintenances (
    id TEXT PRIMARY KEY,
    room_id TEXT,
    building TEXT,
    room_number TEXT,
    category TEXT,
    urgency TEXT DEFAULT 'SEDANG',
    technician TEXT,
    description TEXT,
    report_time TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW()),
    status TEXT NOT NULL DEFAULT 'MENUNGGU_PENUGASAN',
    reported_user TEXT DEFAULT 'System',
    assigned_technician_id TEXT,
    assigned_technician_name TEXT,
    assigned_by_manager TEXT,
    assigned_time TIMESTAMPTZ,
    manager_notes TEXT,
    work_completed_time TIMESTAMPTZ,
    technician_notes TEXT,
    resolved_time TIMESTAMPTZ,
    qc_inspection_id TEXT,
    qc_verdict TEXT,
    facility_type TEXT DEFAULT 'KAMAR',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 10. TABEL QUALITY CONTROL (qc_inspections)
CREATE TABLE IF NOT EXISTS public.qc_inspections (
    id TEXT PRIMARY KEY,
    room_id TEXT,
    building TEXT,
    room_number TEXT,
    inspector_id TEXT,
    inspector_name TEXT,
    inspection_date TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW()),
    cleanliness TEXT DEFAULT 'BAIK',
    linen_bed TEXT DEFAULT 'LENGKAP_BERSIH',
    ac_electricity TEXT DEFAULT 'NORMAL',
    plumbing_water TEXT DEFAULT 'LANCAR',
    amenities TEXT DEFAULT 'LENGKAP',
    result TEXT NOT NULL DEFAULT 'LOLOS_QC',
    decision_type TEXT,
    notes TEXT,
    maintenance_id_created TEXT,
    facility_type TEXT DEFAULT 'KAMAR',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 11. TABEL KOPERASI - MENU MAKAN / SARAPAN (breakfast_menu_items)
CREATE TABLE IF NOT EXISTS public.breakfast_menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Makanan Utama',
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    description TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    allergens TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 12. TABEL KOPERASI - PESANAN SARAPAN (breakfast_orders)
CREATE TABLE IF NOT EXISTS public.breakfast_orders (
    id TEXT PRIMARY KEY,
    room_number TEXT NOT NULL,
    building TEXT,
    guest_name TEXT NOT NULL,
    phone TEXT,
    kloter TEXT,
    transaction_id TEXT,
    menu_id TEXT,
    menu_name TEXT NOT NULL,
    portions INTEGER NOT NULL DEFAULT 1,
    days INTEGER DEFAULT 1,
    start_date DATE,
    delivery_time TEXT DEFAULT '06:30 WIB',
    status TEXT DEFAULT 'MENUNGGU',
    notes TEXT,
    dietary_restriction TEXT,
    price_per_portion NUMERIC(12, 2) DEFAULT 0,
    total_price NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW()),
    updated_at TIMESTAMPTZ
);

-- 13. TABEL AUDIT LOG & VERIFIKASI DOKUMEN (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW()),
    user_name TEXT,
    role TEXT,
    action TEXT NOT NULL,
    details TEXT,
    duration_minutes NUMERIC(8, 2),
    verification_code TEXT,
    document_title TEXT,
    target_id TEXT,
    signatory_name TEXT,
    signatory_role TEXT,
    signatory_nip TEXT,
    qr_code_hash TEXT,
    has_qr_and_signature BOOLEAN DEFAULT TRUE
);

-- 14. TABEL SESI KERJA PETUGAS (work_sessions)
CREATE TABLE IF NOT EXISTS public.work_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    login_time TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW()),
    logout_time TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    duration_formatted TEXT DEFAULT '0 Jam 0 Menit 0 Detik',
    status TEXT DEFAULT 'AKTIF',
    notes TEXT
);

-- 15. TABEL ATOMIC SNAPSHOT SYNC (app_database_sync)
-- Menyimpan state terpadu cadangan untuk 0ms instant sync & mirror Google Spreadsheet
CREATE TABLE IF NOT EXISTS public.app_database_sync (
    id TEXT PRIMARY KEY,
    database_payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- ==============================================================================
-- INDEXING UNTUK EFISIENSI QUERY & LOW EGRESS (Penyaringan Cepat Tanpa Full Scan)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_rooms_building ON public.rooms(building);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_number ON public.rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_qc_status ON public.rooms(qc_status);

CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_room ON public.transactions(room_number);
CREATE INDEX IF NOT EXISTS idx_transactions_dates ON public.transactions(start_date);
CREATE INDEX IF NOT EXISTS idx_transactions_payment ON public.transactions(payment_status);

CREATE INDEX IF NOT EXISTS idx_maintenances_status ON public.maintenances(status);
CREATE INDEX IF NOT EXISTS idx_maintenances_urgency ON public.maintenances(urgency);
CREATE INDEX IF NOT EXISTS idx_maintenances_tech ON public.maintenances(assigned_technician_id);

CREATE INDEX IF NOT EXISTS idx_qc_result ON public.qc_inspections(result);
CREATE INDEX IF NOT EXISTS idx_qc_room ON public.qc_inspections(room_number);

CREATE INDEX IF NOT EXISTS idx_breakfast_orders_status ON public.breakfast_orders(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_users_nip ON public.users(nip);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- 15. TABEL SALURAN & GRUP CHAT (chat_channels)
CREATE TABLE IF NOT EXISTS public.chat_channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'GROUP',
    scope TEXT NOT NULL DEFAULT 'ALL_MANAGERS_GROUP',
    department TEXT,
    participant_ids JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    icon TEXT DEFAULT 'fa-comments',
    last_message TEXT,
    last_message_time TEXT,
    last_sender_name TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 16. TABEL RIWAYAT PESAN CHAT (chat_messages)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    channel_type TEXT NOT NULL DEFAULT 'GROUP',
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    sender_department TEXT,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('Asia/Jakarta', NOW()),
    time_formatted TEXT NOT NULL,
    priority TEXT DEFAULT 'NORMAL',
    is_instruction BOOLEAN DEFAULT FALSE,
    read_by JSONB DEFAULT '[]'::jsonb,
    reply_to_id TEXT,
    reply_to_sender TEXT,
    reply_to_text TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON public.chat_messages(timestamp DESC);

-- ==============================================================================
-- REALTIME OPTIMIZATION: HANYA TABEL KRUSIAL OPERASIONAL (LOW-EGRESS)
-- Menghindari konsumsi bandwidth/koneksi berlebih untuk audit_logs atau menu statis
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenances;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_database_sync;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_capacity_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breakfast_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breakfast_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_database_sync ENABLE ROW LEVEL SECURITY;

-- Kebijakan umum untuk API Key anon/authenticated aplikasi SIM Asrama Haji
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public full access %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Public full access %I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
