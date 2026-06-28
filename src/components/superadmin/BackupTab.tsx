import React, { useState } from "react";
import { 
  Database, Plus, ShieldCheck, Download, RefreshCw, Trash, Play, 
  HelpCircle, Calendar, ShieldAlert, CheckCircle, Clock, AlertTriangle
} from "lucide-react";

interface BackupTabProps {
  isRtl: boolean;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
}

export default function BackupTab({ isRtl, onTriggerNotification }: BackupTabProps) {
  const [backups, setBackups] = useState<any[]>([
    { id: "bak-1", name: "corevia_prod_backup_daily_2026-06-27.sql", size: "1.45 MB", status: "success", created_at: "2026-06-27 01:00:00", type: "Automated" },
    { id: "bak-2", name: "corevia_prod_backup_daily_2026-06-26.sql", size: "1.42 MB", status: "success", created_at: "2026-06-26 01:00:00", type: "Automated" },
    { id: "bak-3", name: "corevia_prod_backup_manual_onboarding.sql", size: "1.12 MB", status: "success", created_at: "2026-06-24 14:15:32", type: "Manual" }
  ]);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleTriggerManualBackup = () => {
    setIsBackingUp(true);
    onTriggerNotification(isRtl ? "جاري تحضير وتثبيت سكريبت لإنشاء نسخة احتياطية سحابية..." : "Initiating encrypted cloud DB backup sequence...", "info");
    
    setTimeout(() => {
      const newBak = {
        id: `bak-${Date.now()}`,
        name: `corevia_prod_backup_manual_${new Date().toISOString().split("T")[0]}.sql`,
        size: "1.46 MB",
        status: "success",
        created_at: new Date().toISOString().replace("T", " ").substring(0, 19),
        type: "Manual"
      };

      setBackups(prev => [newBak, ...prev]);
      setIsBackingUp(false);
      onTriggerNotification(isRtl ? "✅ تم اكتمال حفظ النسخة الاحتياطية السحابية بنجاح!" : "✅ Encrypted SQL snapshot successfully exported and written to cloud CDN!", "success");
    }, 2000);
  };

  const handleDownload = (backupName: string) => {
    // Generate dummy string representing DB snapshot content
    const blobContent = `-- Corevia ERP Postgres Snapshot File\n-- Dumped: ${new Date().toLocaleString()}\nSELECT pg_catalog.setval('public.corevia_companies_id_seq', 1, false);\n`;
    const blob = new Blob([blobContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", backupName);
    link.click();
    onTriggerNotification(isRtl ? "جاري تنزيل ملف السناب شوت للحافظة المحلية..." : "Downloading snapshot SQL script...", "success");
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(isRtl ? "هل أنت متأكد من رغبتك في حذف نسخة الباك اب هذه من السحابة؟" : "Confirm delete of this backup snapshot?")) return;
    setBackups(prev => prev.filter(b => b.id !== id));
    onTriggerNotification(isRtl ? "تم حذف نسخة الباك اب من السحابة بنجاح!" : "SaaS snapshot permanently removed from cloud storage.", "success");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="super_admin_backup_panel">
      
      {/* 1. BACKUP CONTROLS COLUMN */}
      <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-5 h-fit text-right shadow-sm">
        <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800 flex items-center gap-2 justify-end">
          <Database className="w-4 h-4 text-indigo-400" />
          <span>{isRtl ? "إجراءات وتهيئة النسخ الاحتياطي" : "Platform Backup Configuration"}</span>
        </h3>

        <div className="space-y-4">
          {/* Action button */}
          <button
            onClick={handleTriggerManualBackup}
            disabled={isBackingUp}
            className={`w-full py-3 bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-black rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 ${
              isBackingUp ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isBackingUp ? "animate-spin" : ""}`} />
            <span>{isBackingUp ? (isRtl ? "جاري كتابة النسخة الاحتياطية..." : "Writing Cloud Snapshot...") : (isRtl ? "إنشاء نسخة احتياطية فورية (SQL)" : "Trigger Manual Snapshot Now")}</span>
          </button>

          {/* Backup Schedule */}
          <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-850 space-y-3">
            <div className="flex items-center gap-2 text-white justify-end">
              <span className="text-xs font-black">{isRtl ? "جدولة السناب شوت" : "Automated Snapshots Schedule"}</span>
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            </div>

            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                <span className="text-emerald-400 font-bold">✓ Daily Snapshot (01:00 UTC)</span>
                <span>{isRtl ? "تردد التكرار" : "Frequency"}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                <span className="text-white font-mono">S3 / Cloudflare R2</span>
                <span>{isRtl ? "وجهة الحفظ" : "Storage Target"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white">Retention (30 Days)</span>
                <span>{isRtl ? "مدة الاحتفاظ" : "Retention Policy"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SNAPSHOT FILE DIRECTORY ARCHIVE */}
      <div className="lg:col-span-2 bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden flex flex-col h-[520px] shadow-sm">
        
        <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? `سجلات النسخ الاحتياطي السحابية (${backups.length})` : `Active Snapshot Snapshots (${backups.length})`}</span>
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {backups.map((b) => (
            <div key={b.id} className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between text-xs hover:border-zinc-700 transition-all">
              
              <div className="flex items-center gap-2.5">
                {/* Download */}
                <button 
                  onClick={() => handleDownload(b.name)}
                  className="p-1.5 hover:bg-zinc-800 rounded text-indigo-400 hover:text-white transition"
                  title={isRtl ? "تحميل ملف SQL" : "Download SQL Dump"}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {/* Delete */}
                <button 
                  onClick={() => handleDelete(b.id)}
                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-rose-500 transition"
                  title={isRtl ? "حذف السناب شوت" : "Purge Snapshot"}
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className={`${isRtl ? "text-right" : "text-left"} space-y-1`}>
                <span className="font-bold text-white block hover:text-indigo-400 transition-colors cursor-pointer select-all" onClick={() => handleDownload(b.name)}>
                  {b.name}
                </span>
                <div className="flex items-center gap-2 justify-end text-[10px] text-zinc-500 font-mono">
                  <span>Size: {b.size}</span>
                  <span>|</span>
                  <span>{b.created_at}</span>
                  <span>|</span>
                  <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[8px] font-black">{b.type}</span>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>

    </div>
  );
}
