// @ts-nocheck
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { formatRupiah, isMeetingFacility } from '../../lib/utils';
import { Transaction, Room, Maintenance } from '../../types';
import { useAppContext } from '../../store';

interface RoleWorkspaceBannerProps {
  currentUser: any;
  financialStats: {
    totalPenerimaanPnbp: number;
    totalLunasCount: number;
    totalBelumLunasCount: number;
    totalSisaPiutang: number;
    totalDpMasuk: number;
    pnbpHariIni?: number;
    totalEstimatedPNBP?: number;
    unpaidTxs: { 
      tx: Transaction; 
      pricing: any; 
      sisaBayar: number; 
      paid: number;
      isGroup?: boolean;
      groupRecord?: any;
      groupKey?: string;
    }[];
  };
  cateringStats: {
    todayOrders: any[];
    waitingOrders: any[];
    cookingOrders: any[];
    deliveringOrders: any[];
    completedOrders: any[];
    totalPortions: number;
  };
  checkinTodayList: Transaction[];
  checkoutTodayList: Transaction[];
  qcNeedAttentionRooms: Room[];
  urgentMaintenances: Maintenance[];
  activeMaintenances: Maintenance[];
  readyCleanRooms: Room[];
  terisiKamar: number;
  totalKamar: number;
  openModal: (modal: string, data?: any) => void;
  setActiveTab: (tab: string) => void;
  updateBreakfastStatus?: (txId: string, status: any) => void;
  setSelectedBuilding?: (building: string) => void;
}

export function RoleWorkspaceBanner({
  currentUser,
  financialStats,
  cateringStats,
  checkinTodayList,
  checkoutTodayList,
  qcNeedAttentionRooms,
  urgentMaintenances,
  activeMaintenances,
  readyCleanRooms,
  terisiKamar,
  totalKamar,
  openModal,
  setActiveTab,
  updateBreakfastStatus,
  setSelectedBuilding,
}: RoleWorkspaceBannerProps) {
  const roleName = currentUser?.role || 'Pengguna';
  const assignedBuilding = currentUser?.assignedBuilding || 'Semua Gedung';
  const hasAssignedZone = assignedBuilding && !assignedBuilding.includes('Semua') && assignedBuilding !== '-';

  // Badge style based on role
  const getRoleBadge = () => {
    if (roleName.includes('Super Admin') || roleName === 'Admin') {
      return { bg: 'bg-purple-100 text-purple-800 border-purple-300', icon: 'fa-shield-halved' };
    }
    if (roleName.includes('Keuangan') || roleName.includes('Bendahara')) {
      return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'fa-money-bill-wave' };
    }
    if (roleName.includes('Teknisi')) {
      return { bg: 'bg-amber-100 text-amber-800 border-amber-300', icon: 'fa-screwdriver-wrench' };
    }
    if (roleName.includes('QC') || roleName.includes('Quality Control')) {
      return { bg: 'bg-teal-100 text-teal-800 border-teal-300', icon: 'fa-clipboard-check' };
    }
    if (roleName.includes('Koperasi')) {
      return { bg: 'bg-rose-100 text-rose-800 border-rose-300', icon: 'fa-utensils' };
    }
    return { bg: 'bg-blue-100 text-blue-800 border-blue-300', icon: 'fa-bell-concierge' };
  };

  const badge = getRoleBadge();

  const { onlinePresences = [], openChat } = useAppContext();

  // Deduplikasi presensi online per userId dengan validasi waktu aktif < 60 detik
  const activeStaffList = React.useMemo(() => {
    const list = Array.isArray(onlinePresences) ? onlinePresences : [];
    const now = Date.now();
    const map = new Map<string, any>();
    for (const p of list) {
      if (p && p.userId) {
        if (!p.lastSeenMs || now - p.lastSeenMs <= 60000) {
          map.set(p.userId, p);
        }
      }
    }
    // Pastikan user saat ini selalu tercatat aktif
    if (currentUser?.id && !map.has(currentUser.id)) {
      map.set(currentUser.id, {
        userId: currentUser.id,
        userName: currentUser.fullName || currentUser.username,
        userRole: currentUser.role,
        department: currentUser.department || 'Operasional',
        activeTab: 'dashboard',
      });
    }
    return Array.from(map.values());
  }, [onlinePresences, currentUser]);

  // Jumlah rekan kerja lain yang online (selain diri sendiri)
  const otherOnlineStaffCount = React.useMemo(() => {
    return activeStaffList.filter(p => {
      if (!p) return false;
      const pId = String(p.userId || '').toLowerCase();
      const pName = String(p.userName || '').toLowerCase();
      const myId = String(currentUser?.id || '').toLowerCase();
      const myUsername = String(currentUser?.username || '').toLowerCase();
      const myName = String(currentUser?.fullName || '').toLowerCase();
      return pId !== myId && pId !== myUsername && pName !== myName;
    }).length;
  }, [activeStaffList, currentUser]);

  // Penentuan perspektif fokus otomatis berdasarkan peran akun yang login (tanpa tombol filter manual)
  const effectivePerspective = React.useMemo(() => {
    const roleLower = (roleName || '').toLowerCase();
    if (roleLower.includes('keuangan') || roleLower.includes('bendahara')) return 'KEUANGAN';
    if (roleLower.includes('teknisi')) return 'TEKNISI';
    if (roleLower.includes('qc') || roleLower.includes('quality')) return 'QC';
    if (roleLower.includes('koperasi') || roleLower.includes('konsumsi')) return 'KOPERASI';
    if (roleLower.includes('resepsionis') || roleLower.includes('pelayanan')) return 'RESEPSIONIS';
    return 'ALL'; // Super Admin & Admin melihat ringkasan menyeluruh terpadu
  }, [roleName]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
    >
      {/* Top Banner: Greeting, Role & Synchronized Live Online Presence (Tanpa Scroll Horizontal) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-hajj-900 text-white p-3.5 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/10 backdrop-blur-xs text-gold-400 border border-gold-400/30 flex items-center justify-center text-lg shrink-0 shadow-inner">
            <i className={`fa-solid ${badge.icon}`}></i>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                Halo, {currentUser?.fullName || currentUser?.username || 'Petugas'}!
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1.5 shadow-2xs shrink-0 ${badge.bg}`}>
                <i className={`fa-solid ${badge.icon} text-[9px]`}></i>
                <span>{roleName}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-300">
              <span>Departemen: <strong>{currentUser?.department || 'Operasional'}</strong></span>
              {hasAssignedZone && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gold-500/20 text-gold-300 border border-gold-500/30 font-bold text-[11px]">
                    <i className="fa-solid fa-map-pin text-[9px]"></i>
                    <span>Zona Tugas: {assignedBuilding}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Petugas Online Real-Time yang Sinkron, Rapi, & Jelas (Tanpa Scroll Horizontal) */}
        <div className="flex items-center gap-2.5 bg-black/40 px-3 py-2 rounded-xl border border-white/10 text-xs shrink-0 self-start md:self-auto">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-xs">
                  {otherOnlineStaffCount > 0 ? `${otherOnlineStaffCount} Rekan Online` : 'Sesi Anda Aktif'}
                </span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-400/30">
                  Sinkron
                </span>
              </div>
              <span className="text-[10px] text-slate-300 block">
                {otherOnlineStaffCount > 0 ? `${activeStaffList.length} akun aktif bertugas` : 'Menunggu rekan kerja lain online'}
              </span>
            </div>
          </div>

          {/* Avatar stack petugas online */}
          <div className="flex items-center -space-x-1.5 ml-1">
            {activeStaffList.slice(0, 4).map((p, idx) => (
              <div
                key={p.userId || idx}
                title={`${p.userName} (${p.userRole || 'Petugas'} - ${p.department || 'Operasional'})`}
                className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-600 to-gold-400 border-2 border-slate-900 text-slate-950 font-black text-[9px] flex items-center justify-center shadow-xs cursor-pointer"
              >
                {p.userName ? p.userName.charAt(0).toUpperCase() : 'P'}
              </div>
            ))}
            {activeStaffList.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-900 text-white font-bold text-[9px] flex items-center justify-center">
                +{activeStaffList.length - 4}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => openChat?.()}
            className="ml-1 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Buka Panel Obrolan & Kontak Petugas Online"
          >
            <i className="fa-solid fa-comments text-gold-300 text-[11px]"></i>
            <span className="hidden sm:inline">Chat</span>
          </button>
        </div>
      </div>

      {/* Role-Tailored Dynamic Content Area */}
      <div className="p-3.5 sm:p-4 bg-slate-50/70 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
        {/* PERSPECTIVE: KEUANGAN */}
        {effectivePerspective === 'KEUANGAN' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <i className="fa-solid fa-wallet text-emerald-600"></i>
                <span>Fokus Keuangan &amp; PNBP Hari Ini</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('laporanKamar')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
              >
                <span>Buka Laporan &amp; Kwitansi PNBP</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total PNBP Diterima</div>
                <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 mt-1">
                  {formatRupiah(financialStats.totalPenerimaanPnbp)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  <span>{financialStats.totalLunasCount} Transaksi Lunas</span>
                  {Boolean(financialStats.pnbpHariIni && financialStats.pnbpHariIni > 0) && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold block">Hari Ini: +{formatRupiah(financialStats.pnbpHariIni || 0)}</span>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sisa Piutang Berjalan</div>
                <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                  {formatRupiah(financialStats.totalSisaPiutang)}
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
                  {financialStats.totalBelumLunasCount} Tagihan Belum Lunas
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Uang Muka (DP) Masuk</div>
                <div className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-400 mt-1">
                  {formatRupiah(financialStats.totalDpMasuk)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Estimasi Total: {formatRupiah(financialStats.totalEstimatedPNBP || (financialStats.totalPenerimaanPnbp + financialStats.totalSisaPiutang))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tindakan Cepat</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">Kwitansi &amp; Invoice</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('laporanKamar')}
                  className="mt-2 w-full py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <i className="fa-solid fa-receipt text-[10px]"></i>
                  <span>Cek Laporan &amp; Kwitansi</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PERSPECTIVE: TEKNISI */}
        {effectivePerspective === 'TEKNISI' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <i className="fa-solid fa-screwdriver-wrench text-amber-600"></i>
                <span>Fokus Pemeliharaan Sarana &amp; Fasilitas Hari Ini</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('laporanMaintenance')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 flex items-center gap-1 cursor-pointer"
              >
                <span>Buka Tiket Perbaikan Fasilitas</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Tiket Urgent</div>
                <div className="text-base sm:text-lg font-black text-red-600 mt-1">
                  {urgentMaintenances.length} Kasus
                </div>
                <div className="text-[10px] text-red-700 font-semibold mt-0.5">Perlu Tindakan Segera</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perbaikan Berjalan</div>
                <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                  {activeMaintenances.length} Unit
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Dalam Penanganan Teknisi</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kamar Siap Huni</div>
                <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {readyCleanRooms.length} Kamar
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Lolos Uji Standar Kelayakan</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tindakan Lapangan</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">Lapor / Selesai Perbaikan</div>
                </div>
                <button
                  type="button"
                  onClick={() => openModal('modalMaintenanceRequest')}
                  className="mt-2 w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <i className="fa-solid fa-plus text-[10px]"></i>
                  <span>Input Kendala Fasilitas</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PERSPECTIVE: QUALITY CONTROL (QC) */}
        {effectivePerspective === 'QC' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <i className="fa-solid fa-clipboard-check text-teal-600"></i>
                <span>Fokus Penjaminan Mutu &amp; Kelaikan Kamar (QC)</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('qualityControl')}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 dark:text-teal-400 flex items-center gap-1 cursor-pointer"
              >
                <span>Buka Modul Inspeksi Mutu QC</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Menunggu QC</div>
                <div className="text-base sm:text-lg font-black text-purple-700 dark:text-purple-400 mt-1">
                  {qcNeedAttentionRooms.filter(r => r.qcStatus === 'MENUNGGU_QC').length} Kamar
                </div>
                <div className="text-[10px] text-purple-700 font-semibold mt-0.5">Selesai Dikerjakan, Butuh Verifikasi</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perlu Cek / Inspeksi</div>
                <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                  {qcNeedAttentionRooms.length} Unit
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Antrean Pemeriksaan Kamar</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lolos Standar Mutu</div>
                <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {readyCleanRooms.length} Kamar
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Siap Dihuni Jemaah / Tamu</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aksi Verifikasi</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">Form Kendali Mutu</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const candidate = qcNeedAttentionRooms[0] || readyCleanRooms[0];
                    if (candidate) openModal('modalQcInspection', { room: candidate });
                    else setActiveTab('qualityControl');
                  }}
                  className="mt-2 w-full py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <i className="fa-solid fa-magnifying-glass-check text-[10px]"></i>
                  <span>Mulai Cek Kelaikan QC</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PERSPECTIVE: KOPERASI & KONSUMSI */}
        {effectivePerspective === 'KOPERASI' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <i className="fa-solid fa-utensils text-rose-600"></i>
                <span>Fokus Distribusi Makanan &amp; Katering Hari Ini</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('pesananSarapan')}
                className="text-xs font-bold text-rose-700 hover:text-rose-800 dark:text-rose-400 flex items-center gap-1 cursor-pointer"
              >
                <span>Buka Jadwal Katering Lengkap</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Porsi Hari Ini</div>
                <div className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-400 mt-1">
                  {cateringStats.totalPortions} Porsi
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{cateringStats.todayOrders.length} Pesanan Aktif</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Menunggu Diproses</div>
                <div className="text-base sm:text-lg font-black text-amber-600 mt-1">
                  {cateringStats.waitingOrders.length} Pesanan
                </div>
                <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Butuh Penyiapan Dapur</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Sedang Diantar</div>
                <div className="text-base sm:text-lg font-black text-blue-600 mt-1">
                  {cateringStats.deliveringOrders.length} Pesanan
                </div>
                <div className="text-[10px] text-blue-700 font-semibold mt-0.5">Proses Pengantaran ke Kamar</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pesanan Terselesaikan</div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 mt-1">
                    {cateringStats.completedOrders.length} Pesanan
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('pesananSarapan')}
                  className="mt-2 w-full py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <i className="fa-solid fa-list-check text-[10px]"></i>
                  <span>Kelola Status Pesanan</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PERSPECTIVE: RESEPSIONIS */}
        {effectivePerspective === 'RESEPSIONIS' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <i className="fa-solid fa-bell-concierge text-blue-600"></i>
                <span>Fokus Front Desk &amp; Alur Tamu Hari Ini</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('gedung')}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
              >
                <span>Buka Denah &amp; Manajemen Kamar</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Jadwal Check-In Hari Ini</div>
                <div className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-400 mt-1">
                  {checkinTodayList.length} Kamar
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Tamu / Jemaah Masuk</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Jadwal Check-Out Hari Ini</div>
                <div className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-400 mt-1">
                  {checkoutTodayList.length} Kamar
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Selesai Masa Menginap</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Kamar Siap Pakai</div>
                <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 mt-1">
                  {readyCleanRooms.length} Kamar
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Lolos QC, Bersih &amp; Siap Huni</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pemesanan Baru</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">Registrasi Tamu / Jemaah</div>
                </div>
                <button
                  type="button"
                  onClick={() => openModal('modalCheckin', { roomId: readyCleanRooms[0]?.id })}
                  className="mt-2 w-full py-1.5 px-2 bg-hajj-700 hover:bg-hajj-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <i className="fa-solid fa-calendar-plus text-[10px]"></i>
                  <span>Input Tamu / Check-In</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PERSPECTIVE: ALL (EXECUTIVE & PIMPINAN) */}
        {effectivePerspective === 'ALL' && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">Ringkasan Operasional Hari Ini:</span>
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-semibold border border-blue-200 dark:border-blue-800">
                {checkinTodayList.length} Kedatangan
              </span>
              <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded font-semibold border border-rose-200 dark:border-rose-800">
                {checkoutTodayList.length} Kepulangan
              </span>
              <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded font-semibold border border-amber-200 dark:border-amber-800">
                {activeMaintenances.length} Perbaikan
              </span>
              <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded font-semibold border border-teal-200 dark:border-teal-800">
                {qcNeedAttentionRooms.length} Antrean QC
              </span>
              <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-semibold border border-emerald-200 dark:border-emerald-800">
                {readyCleanRooms.length} Kamar Bersih
              </span>
            </div>

            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-[10px]"></i>
              <span>Sistem Operasional Terpadu &amp; Terverifikasi</span>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
