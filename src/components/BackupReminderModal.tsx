import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { generateCompanyBackup } from "../lib/backupEngine";
import type { LanguageType } from "../types";

interface BackupReminderModalProps {
  lang: LanguageType;
  companyId: string;
  companyName: string;
}

const DAYS_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export default function BackupReminderModal({
  lang,
  companyId,
  companyName,
}: BackupReminderModalProps) {
  const isRtl = lang === "ar";
  const [showModal, setShowModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isMissed, setIsMissed] = useState(false);

  useEffect(() => {
    if (!companyId || !supabase) return;

    const checkMissedBackup = async () => {
      try {
        const { data: comp } = await supabase
          .from("corevia_companies")
          .select("backup_reminder_day, backup_reminder_time, last_backup_at")
          .eq("id", companyId)
          .single();

        if (!comp) return;

        const now = new Date();
        const lastBackup = comp.last_backup_at ? new Date(comp.last_backup_at) : new Date(0);
        const targetDayNum = DAYS_MAP[comp.backup_reminder_day || "Thursday"] ?? 4;
        const [hours, minutes] = (comp.backup_reminder_time || "16:00").split(":").map(Number);

        // Compute this week's scheduled reminder date
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() - now.getDay() + targetDayNum);
        targetDate.setHours(hours, minutes, 0, 0);

        // If the scheduled time is still ahead of us, use last week's date
        if (targetDate > now) {
          targetDate.setDate(targetDate.getDate() - 7);
        }

        // Show modal if: now is past the scheduled time AND last backup is older than that time
        if (now >= targetDate && lastBackup < targetDate) {
          const dismissedKey = `backup_missed_${targetDate.toDateString()}`;
          if (!sessionStorage.getItem(dismissedKey)) {
            setIsMissed(true);
            setShowModal(true);
          }
        }
      } catch {
        // silent
      }
    };

    checkMissedBackup();
  }, [companyId]);

  const handleDownload = async () => {
    setIsDownloading(true);
    const ok = await generateCompanyBackup(companyId, companyName);
    setIsDownloading(false);
    if (ok) {
      sessionStorage.setItem(`backup_missed_${new Date().toDateString()}`, "true");
      setShowModal(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(`backup_missed_${new Date().toDateString()}`, "true");
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className={`bg-[#121214] border-2 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl animate-fade-in ${isMissed ? "border-amber-500" : "border-[#27272a]"}`}>
        <div className="text-5xl mb-4">{isMissed ? "⚠️" : "🔔"}</div>
        <h3 className={`text-xl font-black mb-2 ${isMissed ? "text-amber-400" : "text-white"}`}>
          {isMissed
            ? (isRtl ? "تنبيـه: فاتك موعد النسخ الاحتياطي!" : "Missed Backup Alert!")
            : (isRtl ? "تذكير أسبوعي بالنسخ الاحتياطي" : "Weekly Backup Reminder")}
        </h3>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          {isMissed
            ? (isRtl
              ? "لقد مر موعد التذكير المبرمج للنسخ الاحتياطي دون القيام بجلب البيانات. يرجى تنزيل نسختكم الآن للحفاظ على أمان سجلاتكم التجارية."
              : "The scheduled backup time has passed without a download. Please back up now to keep your data safe.")
            : (isRtl
              ? "نذكركم بجلب وتنزيل النسخة الاحتياطية الأسبوعية لقاعدة البيانات لضمان سلامة معلوماتكم من أي فقدان."
              : "This is your scheduled reminder to download a backup ZIP of your company database.")}
        </p>

        <div className="space-y-3">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`w-full font-bold py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isMissed ? "bg-amber-600 hover:bg-amber-500" : "bg-indigo-600 hover:bg-indigo-500"} text-white`}
          >
            {isDownloading
              ? (isRtl ? "⏳ جاري الضغط..." : "⏳ Packaging...")
              : (isRtl ? "📥 جلب وتنزيل البيانات الآن" : "📥 Download Backup Now")}
          </button>
          <button
            onClick={handleDismiss}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-slate-300 hover:text-white py-2.5 rounded-xl transition-all text-sm font-medium cursor-pointer"
          >
            {isRtl ? "تخطي مؤقتاً" : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
